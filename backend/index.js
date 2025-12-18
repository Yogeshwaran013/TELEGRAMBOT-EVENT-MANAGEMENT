import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Telegraf, Markup, session, Scenes } from 'telegraf';

dotenv.config();

const { WizardScene, Stage } = Scenes;
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 3000;

if (!BOT_TOKEN) throw new Error('BOT_TOKEN not set in .env');
if (!MONGO_URI) throw new Error('MONGO_URI not set in .env');

let feedbackAllowed = false;
let ADMIN_IDS = [];

await mongoose.connect(MONGO_URI);
console.log('MongoDB connected');

const settingsSchema = new mongoose.Schema({
  _id: { type: String, default: 'global' },
  feedbackAllowed: { type: Boolean, default: false },
  adminIds: { type: [Number], default: [] }
});
const Settings = mongoose.model('Settings', settingsSchema);

async function loadSettings() {
  let settings = await Settings.findById('global');
  if (!settings) {
    settings = new Settings({
      _id: 'global',
      feedbackAllowed: false,
      adminIds: [6172086498] 
    });
    await settings.save();
  }
  feedbackAllowed = settings.feedbackAllowed;
  ADMIN_IDS = settings.adminIds;

}
await loadSettings();

console.log('Loaded ADMIN_IDS:', ADMIN_IDS);


const userSchema = new mongoose.Schema({
  _id: { type: Number, required: true },       
  name: { type: String, required: true, trim: true },
  mobile: { type: String, required: true },
  batch: { type: Number, enum: [1, 2], required: true },
  feedback: { type: String, default: '' }
}, { timestamps: true , versionKey: false});

const User = mongoose.model('User', userSchema);

async function saveSettings() {
  await Settings.findByIdAndUpdate('global', {
    feedbackAllowed,
    adminIds: ADMIN_IDS
  }, { upsert: true });
}

const stepName = async (ctx) => {
  await ctx.reply('Enter your Full name:');
  return ctx.wizard.next();
};

const stepMobile = async (ctx) => {
  if (!ctx.message || ctx.message.text === undefined) {
    await ctx.reply('Please send text for your name.');
    return; 
  }
  const name = ctx.message.text.trim();
  ctx.wizard.state.data = { name };
  await ctx.reply('Enter your mobile number:');
  return ctx.wizard.next();
};

const stepBatch = async (ctx) => {
  if (!ctx.message || ctx.message.text === undefined) {
    await ctx.reply('Please send text for your mobile number.');
    return;
  }
  const mobile = ctx.message.text.trim();
  if (!/^\d{10}$/.test(mobile)) {
    await ctx.reply('Invalid mobile number. Enter exactly 10 digits (numbers only):');
    return;
  }
  ctx.wizard.state.data.mobile = mobile;
  await ctx.reply(
    'Select your batch:',
    Markup.inlineKeyboard([
      [Markup.button.callback('Batch 1', 'batch:1')],
      [Markup.button.callback('Batch 2', 'batch:2')],
      [Markup.button.callback('Cancel', 'cancel')]
    ])
  );
  return ctx.wizard.next();
};

const stepSave = async (ctx) => {
  if (!ctx.callbackQuery) {
    await ctx.reply('Please use the buttons to select a batch.');
    return;
  }

  const data = ctx.callbackQuery.data;
  await ctx.answerCbQuery();
  
  if (data === 'cancel') {
    await ctx.reply('Current process is cancelled.');
    return ctx.scene.leave();
  }

  if (!/^batch:(1|2)$/.test(data)) {
    return ctx.reply('Invalid selection. Please choose Batch 1 or Batch 2.');
  }

  const selectedBatch = Number(data.split(':')[1]);
  ctx.wizard.state.data.batch = selectedBatch;

  const payload = {
    _id: ctx.from.id,
    name: ctx.wizard.state.data.name,
    mobile: ctx.wizard.state.data.mobile,
    batch: selectedBatch
  };

  try {
    await User.findByIdAndUpdate(
      ctx.from.id,
      payload,
      { upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );
    await ctx.reply(
      `✅ Registration complete!\n\n` +
      `Name: ${payload.name}\nMobile: ${payload.mobile}\nBatch: ${payload.batch}`
    );
  } catch (err) {
    console.error('DB error saving user:', err);
    await ctx.reply('❌ Error saving your data. Please try again later.');
  }

  return ctx.scene.leave();
};


const registerWizard = new WizardScene(
  'register-wizard',
  stepName,
  stepMobile,
  stepBatch,
  stepSave

//   async (ctx) => {
//     await ctx.reply('Please Select Your Batch !');
//   }
);

const stage = new Stage([registerWizard], { default: null });
const bot = new Telegraf(BOT_TOKEN);
bot.use(session());
bot.use(stage.middleware());

bot.command('cancel', async (ctx) => {
  if (ctx.scene?.current) {
    await ctx.reply('Current process is cancelled.');
    await ctx.scene.leave();
  } else {
    await ctx.reply('Nothing to cancel.');
  }
});

bot.start(async (ctx) => {
  await ctx.reply(
    'Welcome! Use /register to start registration or press the button below.',
    Markup.inlineKeyboard([
      [Markup.button.callback('Register', 'start_register')],
      [Markup.button.callback('Info', 'info')]
    ])
  );
});


bot.command('register', async (ctx) => {
    if(await User.findById(ctx.from.id).lean()){
        ctx.reply("You have Already Registered!");
        return;
    }
    ctx.scene.enter('register-wizard')});

bot.action('start_register', async (ctx) => {
  await ctx.answerCbQuery();
  if(await User.findById(ctx.from.id).lean()){
    ctx.reply("You have Already Registered!");
    return;
  }
  return ctx.scene.enter('register-wizard');
});

bot.action('info', async (ctx) => {
  await ctx.answerCbQuery();
  const id = ctx.from.id;
  const user = await User.findById(id).lean();
  if (!user) return ctx.reply(`No registration found for you (ID: ${id}). Use /register.`);
  return ctx.reply(`Your registration:\nName: ${user.name}\nMobile: ${user.mobile}\nBatch: ${user.batch}`);
});

bot.on('message', async (ctx, next) => {
  return next();
});

bot.command('info', async (ctx) => {
  const id = ctx.from.id;
  const user = await User.findById(id).lean();
  if (!user) return ctx.reply('You are not registered. Use /register.');
  ctx.reply(`Your Registration:\nName: ${user.name}\nMobile: ${user.mobile}\nBatch: ${user.batch}`);
});


const app = express();
app.use(express.json());
// Configure CORS to allow dev origins or use an env var (comma-separated)
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5174').split(',')
app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (like curl or server-to-server)
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) return callback(null, true)
    return callback(null, false)
  },
  optionsSuccessStatus: 200
}))

app.get('/users', async (req, res) => {
  try {
    const batch = req.query.batch ? Number(req.query.batch) : null
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 0
    const q = batch ? { batch } : {}
    const query = User.find(q).sort({ createdAt: -1 }).lean()
    if (limit > 0) query.limit(limit)
    const users = await query.exec()
    res.json(users)
  } catch (err) {
    console.error('Error fetching users', err)
    res.status(500).json({ error: 'Failed to fetch users' })
  }
});

// Broadcast message to users (no admin ID required). Accepts optional `batch` in body to target specific batch.
app.post('/broadcast', async (req, res) => {
  try {
    const { batch, message } = req.body
    if (!message || typeof message !== 'string') return res.status(400).json({ error: 'message required' })

    let q = {}
    if (batch !== undefined && batch !== null && batch !== '' ) {
      const b = Number(batch)
      if (b === 1 || b === 2) q = { batch: b }
    }

    const users = await User.find(q).lean()

    const results = { sent: 0, failed: 0, failures: [] }
    for (const u of users) {
      try {
        await bot.telegram.sendMessage(u._id, message)
        results.sent++
      } catch (err) {
        results.failed++
        results.failures.push({ id: u._id, error: String(err.message || err) })
      }
    }

    res.json(results)
  } catch (err) {
    console.error('Broadcast error', err)
    res.status(500).json({ error: 'Broadcast failed' })
  }
})

bot.command('set_feedback', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) {
    console.log(ADMIN_IDS)
    return;
  }

  const arg = ctx.message.text.split(' ')[1]?.toLowerCase();
  if (!['on', 'off'].includes(arg)) {
    return ctx.reply('Usage: /set_feedback on|off');
  }

  feedbackAllowed = arg === 'on';
  await saveSettings();

  ctx.reply(`✅ Feedback is now ${feedbackAllowed ? 'ENABLED' : 'DISABLED'} for all users.`);
});

bot.command('feedback', async (ctx) => {
  if (!feedbackAllowed) {
    return ctx.reply('❌ Feedback is currently closed.');
  }

  const user = await User.findById(ctx.from.id).lean();
  if (!user) {
    return ctx.reply('❌ You must be registered to give feedback.');
  }

  ctx.session.awaitingFeedback = true;
  await ctx.reply('Please send your feedback now:');
});


bot.on('text', async (ctx,next) => {
  if (ctx.session.awaitingFeedback) {
    ctx.session.awaitingFeedback = false;

    await User.findByIdAndUpdate(
      ctx.from.id,
      { feedback: ctx.message.text }
    );

    await ctx.reply('✅ Thank you for your feedback!');
  }else
    next();
});

bot.hears(/hi|hello/i, (ctx) => ctx.reply(`Hi ${ctx.from.first_name || ''}!`));

bot.command('add_admin', async (ctx) => {
  const callerId = Number(ctx.from.id);
  if (!ADMIN_IDS.includes(callerId)) {
    await ctx.reply('❌ Unauthorized — only admins can add other admins.');
    return;
  }

  const arg = ctx.message.text.split(' ')[1];
  const id = Number(arg);
  if (!id) return ctx.reply('Usage: /add_admin <telegramId>');

  if (!ADMIN_IDS.includes(id)) {
    ADMIN_IDS.push(id);
    await saveSettings();
    ctx.reply(`✅ Added admin: ${id}`);
  } else {
    ctx.reply(`ℹ️ ID ${id} is already an admin.`);
  }
});


app.listen(PORT, () => console.log(`Express listening on ${PORT}`));

await bot.launch();
console.log('Bot launched');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
