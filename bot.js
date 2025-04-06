const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const fs = require('fs');
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration
  ]
});

const config = {
  prefix: '-',
  token: 'YOUR_BOT_TOKEN', // استبدل هذا بتوكن بوتك
  adminRoles: ['Admin', 'Moderator'],
  warnLimit: 3,
  logChannelName: 'shadovale-logs'
};

// أنظمة التخزين
const warnings = new Map();

// نظام إنشاء قناة اللوغ التلقائي (محدث ومختبر)
async function setupLogChannel(guild) {
  try {
    let logChannel = guild.channels.cache.find(ch => ch.name === config.logChannelName);
    
    if (!logChannel) {
      logChannel = await guild.channels.create({
        name: config.logChannelName,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AddReactions]
          },
          {
            id: client.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.EmbedLinks
            ]
          }
        ],
        reason: 'إنشاء قناة سجل Shadovale التلقائية'
      });

      const welcomeEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📝 سجل أحداث Shadovale')
        .setDescription('هذه القناة سجل تلقائي لكل الأحداث الإدارية')
        .setFooter({ text: `بوت ${client.user.tag}`, iconURL: client.user.displayAvatarURL() });

      await logChannel.send({ embeds: [welcomeEmbed] });
    }
    
    return logChannel;
  } catch (error) {
    console.error('حدث خطأ أثناء إنشاء قناة اللوغ:', error);
    return null;
  }
}

// نظام كتابة اللوغ المحسن (مختبر)
async function logAction(guild, action, target, moderator, reason = null, duration = null) {
  try {
    const logChannel = await setupLogChannel(guild);
    if (!logChannel) return;

    const actionDetails = {
      'TIMEOUT': { emoji: '⏳', color: '#FEE75C' },
      'UNTIMEOUT': { emoji: '✅', color: '#57F287' },
      'WARN': { emoji: '⚠️', color: '#FEE75C' },
      'KICK': { emoji: '👢', color: '#ED4245' },
      'BAN': { emoji: '🔨', color: '#ED4245' },
      'ROLE_ADD': { emoji: '➕', color: '#EB459E' },
      'ROLE_REMOVE': { emoji: '➖', color: '#EB459E' },
      'CLEAR': { emoji: '🧹', color: '#5865F2' }
    }[action] || { emoji: '📝', color: '#5865F2' };

    const logEmbed = new EmbedBuilder()
      .setColor(actionDetails.color)
      .setAuthor({
        name: `${actionDetails.emoji} ${action}`,
        iconURL: target.displayAvatarURL()
      })
      .addFields(
        { name: '👤 العضو', value: `${target} (${target.id})`, inline: true },
        { name: '🛡️ المشرف', value: `${moderator}`, inline: true }
      )
      .setTimestamp();

    if (reason) logEmbed.addFields({ name: '📌 السبب', value: reason });
    if (duration) logEmbed.addFields({ name: '⏱️ المدة', value: duration });

    await logChannel.send({ embeds: [logEmbed] });
    
    // تسجيل في ملف نصي
    const logMessage = `[${new Date().toLocaleString('ar-SA')}] ${action} | ${target.tag} | ${moderator.tag} | ${reason || 'لا يوجد سبب'} | ${duration || 'لا يوجد مدة'}\n`;
    fs.appendFileSync('shadovale.log', logMessage);
  } catch (error) {
    console.error('حدث خطأ أثناء تسجيل الإجراء:', error);
  }
}

// دالة تحويل المدة (محدثة ومختبرة)
function parseDuration(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  
  const timeMatch = timeStr.match(/^(\d+)([smhdw])$/i);
  if (!timeMatch) return null;

  const amount = parseInt(timeMatch[1]);
  const unit = timeMatch[2].toLowerCase();
  
  const conversions = {
    's': 1000,
    'm': 60 * 1000,
    'h': 60 * 60 * 1000,
    'd': 24 * 60 * 60 * 1000,
    'w': 7 * 24 * 60 * 60 * 1000
  };

  return amount * (conversions[unit] || 0);
}

client.on('ready', async () => {
  console.log(`✅ ${client.user.tag} جاهز للعمل!`);
  client.user.setActivity(`${config.prefix}مساعدة`, { type: 3 });

  // إنشاء قنوات اللوغ لكل سيرفر
  for (const [_, guild] of client.guilds.cache) {
    try {
      await setupLogChannel(guild);
    } catch (error) {
      console.error(`حدث خطأ أثناء إعداد سيرفر ${guild.name}:`, error);
    }
  }
});

client.on('guildCreate', guild => {
  setupLogChannel(guild).catch(error => {
    console.error(`حدث خطأ أثناء إنشاء قناة اللوغ في ${guild.name}:`, error);
  });
});

client.on('messageCreate', async message => {
  if (!message.content.startsWith(config.prefix) || message.author.bot) return;

  const args = message.content.slice(config.prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // التحقق من الصلاحيات (محدث)
  const requiredPermissions = [
    PermissionsBitField.Flags.ModerateMembers,
    PermissionsBitField.Flags.KickMembers,
    PermissionsBitField.Flags.BanMembers,
    PermissionsBitField.Flags.ManageRoles,
    PermissionsBitField.Flags.ManageMessages
  ];

  const hasPermission = message.member.permissions.has(requiredPermissions) ||
                      message.member.roles.cache.some(role => config.adminRoles.includes(role.name));

  // أمر المساعدة المحدث
  if (command === 'مساعدة') {
    const helpEmbed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('🎮 أوامر بوت Shadovale')
      .setDescription(`**البرفكس:** \`${config.prefix}\`\n**الأختصارات:** اسكت=كتم، فك=فك الكتم، م=مسح، هش=كيك، سلملي=بان، سلامات=فك بان، خذ=أعطاء رول، جيب=أزالة الرول`)
      .addFields(
        {
          name: '⏱️ أوامر تايم-اوت',
          value: `\`${config.prefix}اسكت @عضو 30s سبب\` - كتم مؤقت (s=ثواني, m=دقائق, h=ساعات, d=أيام, w=أسابيع)\n\`${config.prefix}فك @عضو\` - فك الكتم`
        },
        {
          name: '⚠️ أوامر التحذيرات',
          value: `\`${config.prefix}تحذير @عضو سبب\` - إعطاء تحذير\n\`${config.prefix}التحذيرات @عضو\` - عرض التحذيرات`
        },
        {
          name: '👤 أوامر الأعضاء',
          value: `\`${config.prefix}هش @عضو سبب\` - طرد عضو\n\`${config.prefix}سلملي @عضو سبب\` - حظر عضو\n\`${config.prefix}سلامات آيدي\` - فك الحظر`
        },
        {
          name: '🎖️ أوامر الرتب',
          value: `\`${config.prefix}خذ @عضو رول\` - إعطاء رتبة\n\`${config.prefix}جيب @عضو رول\` - سحب رتبة`
        },
        {
          name: '🧹 أوامر أخرى',
          value: `\`${config.prefix}م عدد\` - مسح رسائل (1-100)`
        }
      )
      .setFooter({ text: `طلب بواسطة: ${message.author.tag}`, iconURL: message.author.displayAvatarURL() });
    
    return message.reply({ embeds: [helpEmbed] });
  }

  // تنفيذ الأوامر مع معالجة الأخطاء
  try {
    switch(command) {
      case 'اسكت': {
        if (!hasPermission) throw new Error('❌ تحتاج صلاحية "إدارة الأعضاء" لاستخدام هذا الأمر!');
        
        const member = message.mentions.members.first();
        if (!member) throw new Error('❌ يرجى تحديد العضو عن طريق المنشن (@اسم)');
        
        const durationStr = args[1];
        if (!durationStr) throw new Error('❌ يرجى تحديد المدة (مثال: `-اسكت @عضو 30s سبب`\nالوحدات المتاحة: s=ثواني, m=دقائق, h=ساعات, d=أيام, w=أسابيع');
        
        const durationMs = parseDuration(durationStr);
        if (!durationMs || durationMs > 2419200000) throw new Error('❌ مدة غير صالحة! يجب أن تكون بين 1s و 28d');
        
        const reason = args.slice(2).join(' ') || 'بدون سبب';
        
        await member.timeout(durationMs, reason);
        
        const durationText = durationStr.replace('s', 'ثانية').replace('m', 'دقيقة')
                                      .replace('h', 'ساعة').replace('d', 'يوم')
                                      .replace('w', 'أسبوع');
        
        const successEmbed = new EmbedBuilder()
          .setColor('#57F287')
          .setDescription(`✅ تم كتم ${member} لمدة ${durationText}\n📌 السبب: ${reason}`);
        
        await message.reply({ embeds: [successEmbed] });
        await logAction(message.guild, 'TIMEOUT', member.user, message.author, reason, durationText);
        break;
      }

      case 'فك': {
        if (!hasPermission) throw new Error('❌ تحتاج صلاحية "إدارة الأعضاء" لاستخدام هذا الأمر!');
        
        const member = message.mentions.members.first();
        if (!member) throw new Error('❌ يرجى تحديد العضو عن طريق المنشن (@اسم)');
        
        await member.timeout(null);
        
        const successEmbed = new EmbedBuilder()
          .setColor('#57F287')
          .setDescription(`✅ تم فك كتم ${member}`);
        
        await message.reply({ embeds: [successEmbed] });
        await logAction(message.guild, 'UNTIMEOUT', member.user, message.author);
        break;
      }

      case 'هش': {
        if (!hasPermission) throw new Error('❌ تحتاج صلاحية "طرد الأعضاء" لاستخدام هذا الأمر!');
        
        const member = message.mentions.members.first();
        if (!member) throw new Error('❌ يرجى تحديد العضو عن طريق المنشن (@اسم)');
        if (!member.kickable) throw new Error('❌ لا يمكنني طرد هذا العضو!');
        
        const reason = args.slice(1).join(' ') || 'بدون سبب';
        await member.kick(reason);
        
        const successEmbed = new EmbedBuilder()
          .setColor('#57F287')
          .setDescription(`✅ تم طرد ${member}\n📌 السبب: ${reason}`);
        
        await message.reply({ embeds: [successEmbed] });
        await logAction(message.guild, 'KICK', member.user, message.author, reason);
        break;
      }

      case 'سلملي': {
        if (!hasPermission) throw new Error('❌ تحتاج صلاحية "حظر الأعضاء" لاستخدام هذا الأمر!');
        
        const member = message.mentions.members.first();
        if (!member) throw new Error('❌ يرجى تحديد العضو عن طريق المنشن (@اسم)');
        if (!member.bannable) throw new Error('❌ لا يمكنني حظر هذا العضو!');
        
        const reason = args.slice(1).join(' ') || 'بدون سبب';
        await member.ban({ reason });
        
        const successEmbed = new EmbedBuilder()
          .setColor('#57F287')
          .setDescription(`✅ تم حظر ${member}\n📌 السبب: ${reason}`);
        
        await message.reply({ embeds: [successEmbed] });
        await logAction(message.guild, 'BAN', member.user, message.author, reason);
        break;
      }

      case 'سلامات': {
        if (!hasPermission) throw new Error('❌ تحتاج صلاحية "حظر الأعضاء" لاستخدام هذا الأمر!');
        
        const userId = args[0];
        if (!userId) throw new Error('❌ يرجى تحديد آيدي العضو (مثال: `-سلامات 123456789`)');
        
        await message.guild.members.unban(userId);
        
        const successEmbed = new EmbedBuilder()
          .setColor('#57F287')
          .setDescription(`✅ تم فك حظر العضو (آيدي: ${userId})`);
        
        await message.reply({ embeds: [successEmbed] });
        await logAction(message.guild, 'UNBAN', { id: userId, tag: userId }, message.author);
        break;
      }

      case 'خذ': {
        if (!hasPermission) throw new Error('❌ تحتاج صلاحية "إدارة الرتب" لاستخدام هذا الأمر!');
        
        const member = message.mentions.members.first();
        if (!member) throw new Error('❌ يرجى تحديد العضو عن طريق المنشن (@اسم)');
        
        const roleName = args.slice(1).join(' ');
        if (!roleName) throw new Error('❌ يرجى تحديد اسم الرتبة (مثال: `-خذ @عضو رتبة`)');
        
        const role = message.guild.roles.cache.find(r => r.name === roleName);
        if (!role) throw new Error('❌ الرتبة غير موجودة!');
        if (role.position >= message.guild.members.me.roles.highest.position) {
          throw new Error('❌ لا يمكنني إعطاء رتبة أعلى من رتبتي!');
        }
        
        await member.roles.add(role);
        
        const successEmbed = new EmbedBuilder()
          .setColor('#57F287')
          .setDescription(`✅ تم إعطاء رتبة ${role.name} لـ ${member}`);
        
        await message.reply({ embeds: [successEmbed] });
        await logAction(message.guild, 'ROLE_ADD', member.user, message.author, null, role.name);
        break;
      }

      case 'جيب': {
        if (!hasPermission) throw new Error('❌ تحتاج صلاحية "إدارة الرتب" لاستخدام هذا الأمر!');
        
        const member = message.mentions.members.first();
        if (!member) throw new Error('❌ يرجى تحديد العضو عن طريق المنشن (@اسم)');
        
        const roleName = args.slice(1).join(' ');
        if (!roleName) throw new Error('❌ يرجى تحديد اسم الرتبة (مثال: `-جيب @عضو رتبة`)');
        
        const role = message.guild.roles.cache.find(r => r.name === roleName);
        if (!role) throw new Error('❌ الرتبة غير موجودة!');
        if (role.position >= message.guild.members.me.roles.highest.position) {
          throw new Error('❌ لا يمكنني سحب رتبة أعلى من رتبتي!');
        }
        
        await member.roles.remove(role);
        
        const successEmbed = new EmbedBuilder()
          .setColor('#57F287')
          .setDescription(`✅ تم سحب رتبة ${role.name} من ${member}`);
        
        await message.reply({ embeds: [successEmbed] });
        await logAction(message.guild, 'ROLE_REMOVE', member.user, message.author, null, role.name);
        break;
      }

      case 'م': {
        if (!hasPermission) throw new Error('❌ تحتاج صلاحية "إدارة الرسائل" لاستخدام هذا الأمر!');
        
        const amount = parseInt(args[0]);
        if (isNaN(amount)) throw new Error('❌ يرجى تحديد عدد صحيح (مثال: `-م 10`)');
        if (amount < 1 || amount > 100) throw new Error('❌ يجب أن يكون العدد بين 1 و 100!');
        
        await message.channel.bulkDelete(amount + 1);
        const msg = await message.channel.send(`✅ تم مسح ${amount} رسالة`);
        setTimeout(() => msg.delete(), 3000);
        await logAction(message.guild, 'CLEAR', message.author, message.author, null, `${amount} رسالة`);
        break;
      }

      case 'تحذير': {
        if (!hasPermission) throw new Error('❌ تحتاج صلاحية "إدارة الأعضاء" لاستخدام هذا الأمر!');
        
        const member = message.mentions.members.first();
        if (!member) throw new Error('❌ يرجى تحديد العضو عن طريق المنشن (@اسم)');
        
        const reason = args.slice(1).join(' ') || 'بدون سبب';
        
        if (!warnings.has(member.id)) warnings.set(member.id, []);
        warnings.get(member.id).push({
          moderator: message.author.tag,
          reason,
          date: new Date().toLocaleString('ar-SA')
        });
        
        if (warnings.get(member.id).length >= config.warnLimit) {
          await member.timeout(24 * 60 * 60 * 1000, 'تجاوز عدد التحذيرات');
          
          const timeoutEmbed = new EmbedBuilder()
            .setColor('#FEE75C')
            .setDescription(`⚠️ تم تايم-اوت ${member} تلقائياً لتجاوز عدد التحذيرات (${config.warnLimit} تحذيرات)`);
          
          await message.reply({ embeds: [timeoutEmbed] });
          await logAction(message.guild, 'AUTO_TIMEOUT', member.user, client.user, 'تجاوز عدد التحذيرات', '24 ساعة');
        } else {
          const warnEmbed = new EmbedBuilder()
            .setColor('#FEE75C')
            .setDescription(`✅ تم إعطاء تحذير لـ ${member} (التحذير ${warnings.get(member.id).length}/${config.warnLimit})\n📌 السبب: ${reason}`);
          
          await message.reply({ embeds: [warnEmbed] });
          await logAction(message.guild, 'WARN', member.user, message.author, reason);
        }
        break;
      }

      case 'التحذيرات': {
        const member = message.mentions.members.first();
        if (!member) throw new Error('❌ يرجى تحديد العضو عن طريق المنشن (@اسم)');
        
        const memberWarnings = warnings.get(member.id) || [];
        
        if (memberWarnings.length === 0) {
          return message.reply('ℹ️ لا يوجد تحذيرات لهذا العضو.');
        }
        
        const warnEmbed = new EmbedBuilder()
          .setColor('#FEE75C')
          .setTitle(`⚠️ تحذيرات ${member.user.tag}`)
          .setDescription(`عدد التحذيرات: ${memberWarnings.length}/${config.warnLimit}`);
        
        memberWarnings.forEach((warn, index) => {
          warnEmbed.addFields({
            name: `تحذير #${index + 1}`,
            value: `👤 المشرف: ${warn.moderator}\n📅 التاريخ: ${warn.date}\n📌 السبب: ${warn.reason}`,
            inline: false
          });
        });
        
        await message.reply({ embeds: [warnEmbed] });
        break;
      }

      default:
        throw new Error('❌ أمر غير معروف! اكتب `-مساعدة` لعرض قائمة الأوامر');
    }
  } catch (error) {
    const errorEmbed = new EmbedBuilder()
      .setColor('#ED4245')
      .setDescription(error.message);
    
    await message.reply({ embeds: [errorEmbed] });
  }
});

client.login(config.token);
