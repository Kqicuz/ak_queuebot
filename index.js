const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const prefix = '.';
const queueFilePath = 'queue.json';
const config = require('./config.json');

const client = new Client({
  intents: [Object.keys(GatewayIntentBits)],
  partials: [Object.keys(Partials)],
});

client.commands = new Map();

const allowedUserIds = config.allowedUserIds;

let queue = [];

try {
  const data = fs.readFileSync(queueFilePath, 'utf8');
  queue = JSON.parse(data);
} catch (err) {
  if (err.code === 'ENOENT') {
    fs.writeFileSync(queueFilePath, '[]', 'utf8');
    console.log(`File ${queueFilePath} created.`);
  } else {
    console.error('Error loading queue from file:', err);
  }
}

client.on('ready', () => {
  console.log(`${client.user.tag} is now online.`);
  client.user.setActivity('Current Queue', { type: 'WATCHING' });

  queue.forEach(entry => {
    console.log(`Tag: ${entry.user.tag} - Product: ${entry.product}`);
  });
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith(prefix)) return;

  if (!allowedUserIds.includes(message.author.id)) {
    message.reply('You are not authorized to use this bot.');
    return;
  }

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'queue-add') {
    const user = message.mentions.users.first();
    const product = args.join(' ');

    queue.push({ user, product });

    message.reply(`Added ${product} to the queue`);
    saveQueueToFile();
  } else if (command === 'queue-view') {
    if (queue.length === 0) {
      message.reply('The queue is empty.');
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`Kqi's Queue Bot`)
      .setColor('White')
      .setThumbnail('https://t3.gstatic.com/licensed-image?q=tbn:ANd9GcTHsK1ZoItA_jI8Qsh_g-KScUGYtHjh5MqFuQGjFQAXyKD8UYneQToPyqYOgGzQWnbl')
      .setFooter({ text: `${client.user.tag}` })
      .setTimestamp();
    queue.forEach((entry, index) => {
      embed.addFields({
        name: `${index + 1}.`,
        value: `${entry.product}`,
        inline: false,
      });
    });

    message.reply({ embeds: [embed] });
  } else if (command === 'queue-remove') {
    const indexToRemove = parseInt(args[0]);

    if (isNaN(indexToRemove) || indexToRemove <= 0 || indexToRemove > queue.length) {
      message.reply('Invalid index. Please provide a valid index from the queue.');
      return;
    }

    const removedEntry = queue.splice(indexToRemove - 1, 1)[0];
    message.reply(`Removed ${removedEntry.user.tag} from the queue.`);
    saveQueueToFile();
  } else if (command === 'queue-clear') {
    if (queue.length === 0) {
      message.reply('The queue is already empty.');
      return;
    }

    queue.length = 0;
    saveQueueToFile();

    message.reply('The queue has been cleared.');
  }
});

process.on('beforeExit', () => {
  saveQueueToFile();
});

function saveQueueToFile() {
  try {
    const data = JSON.stringify(queue, null, 2);
    fs.writeFileSync(queueFilePath, data, 'utf8');
  } catch (err) {
    console.error('Error saving queue to file:', err);
  }
}

const commandFiles = fs.readdirSync('./Commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(`./Commands/${file}`);
  client.commands.set(command.name, command);
}

client.on('messageCreate', async (message) => {
  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  const command = client.commands.get(commandName);

  if (!command) return;

  try {
    command.execute(message, args, queue, saveQueueToFile);
  } catch (error) {
    console.error(error);
    message.reply('There was an error executing the command.');
  }
});

client.login(config.token);