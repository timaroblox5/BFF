require('dotenv').config();

const Discord = require('discord.js');
const mongoose = require('mongoose');
const fs = require('fs');
const config = require('./src/config.json');

// Добавляем префикс в конфигурацию
const PREFIX = 'f4!';

// Подключение к MongoDB
mongoose.connect(config.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('Error connecting to MongoDB:', err);
});

const client = new Discord.Client();
client.commands = new Discord.Collection();

// Take commands
const commandFiles = fs.readdirSync('./src/commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`./src/commands/` + file);
    client.commands.set(command.name, command);
}

// Cooldowns
const cooldowns = new Discord.Collection();

// Set bot status
client.once('ready', () => {
    console.log('Bot is ready!');
    client.user.setPresence({
        status: 'online',
        activity: {
            name: `${PREFIX}help | ${client.guilds.cache.size} servers`,
            type: 'WATCHING'
        }
    });
});

// On Message
client.on('message', message => {
    if (!message.content.startsWith(PREFIX) || message.author.bot) return;

    const args = message.content.slice(PREFIX.length).split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName) || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

    // If command exist
    if (!command) return;

    // Check if command can be executed in DM
    if (command.guildOnly && message.channel.type !== 'text') {
        return message.reply('I can\'t execute that command inside DMs!');
    }

    // Check if args are required
    if (command.args && !args.length) {
        let reply = `You didn't provide any arguments, ${message.author}!`;

        if (command.usage) {
            reply += `\nThe proper usage would be: \`${PREFIX}${command.name} ${command.usage}\``;
        }

        return message.channel.send(reply);
    }

    // Check if user is in cooldown
    if (!cooldowns.has(command.name)) {
        cooldowns.set(command.name, new Discord.Collection());
    }

    const now = Date.now();
    const timestamps = cooldowns.get(command.name);
    const cooldownAmount = (command.cooldown || 3) * 1000;

    if (timestamps.has(message.author.id)) {
        const expirationTime = timestamps.get(message.author.id) + cooldownAmount;

        if (now < expirationTime) {
            // If user is in cooldown
            const timeLeft = (expirationTime - now) / 1000;
            return message.reply(`please wait ${timeLeft.toFixed(1)} more second(s) before reusing the \`${command.name}\` command.`);
        }
    } else {
        timestamps.set(message.author.id, now);
        setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);
        // Execute command
        try {
            command.execute(message, args, PREFIX, client.commands);
        } catch (error) {
            console.error(error);
            message.reply('there was an error trying to execute that command!');
        }
    }
});

client.login(config.TOKEN);
