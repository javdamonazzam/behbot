import { Injectable, OnModuleInit } from '@nestjs/common';
import { Telegraf, Markup } from 'telegraf';
import axios from 'axios';

@Injectable()
export class TelegramService implements OnModuleInit {
    private bot: Telegraf;
    private userStates: Map<number, string> = new Map();

    constructor() {
        this.bot = new Telegraf('7688258011:AAG28d4p3z4uxCiryylyNUPpQXYft3CM99I'); // 🔐 حواست باشه این توکن نره دست کسی
    }

    async onModuleInit() {
        this.bot.start(async (ctx) => {
            await ctx.reply(
                'یکی از گزینه‌های زیر را انتخاب کنید:',
                Markup.keyboard([
                    ['🛒 سرویس جدید'],
                    ['حذف'],
                    ['لیست']
                ]).resize()
            );
        });

        // حالت خرید
        this.bot.hears('🛒 سرویس جدید', async (ctx) => {
            const chatId = ctx.message.chat.id;
            this.userStates.set(chatId, 'BUY');

            await ctx.reply("📝 لطفاً اسم دلخواه برای سرویس‌تان را وارد کنید:");
        });

        // حالت حذف
        this.bot.hears('حذف', async (ctx) => {
            const chatId = ctx.message.chat.id;
            this.userStates.set(chatId, 'DELETE');

            await ctx.reply("📝 لطفاً اسم سرویسی که می‌خواهید حذف کنید را وارد نمایید:");
        });
        this.bot.hears('لیست', async (ctx) => {
            try {
                const res = await axios.get('http://79.133.46.247:3000/list');
                const cleanedData = res.data
                    .split('\n')  // جدا کردن هر خط
                    .filter(line => line.trim() !== '')  // حذف خطوط خالی
                    .map(line => line.replace(/^\s*\d+\)\s*/, ''));  // حذف شماره و parantheses


                // ارسال هر مورد به تلگرام
                for (const item of cleanedData) {
                    await ctx.reply(`📄 ${item}`, {
                        reply_markup: {
                            inline_keyboard: [[
                                { text: '❌ حذف', callback_data: `delete_${item}` }
                            ]]
                        }
                    });
                }

                // if (lines.length === 0) {
                //     await ctx.reply('📭 لیست خالی است.');
                // }
            } catch (err) {
                await ctx.reply('⚠️ خطا در دریافت لیست سرویس‌ها.');
            }
        });

        // این بخش باید خارج از hears باشه 👇
        this.bot.on('callback_query', async (ctx: any) => {
            const callbackData = ctx.callbackQuery.data;

            if (callbackData.startsWith('delete_')) {
                const nameToDelete = callbackData.replace('delete_', '');  // حذف 'delete_'

                try {
                    await axios.get(`http://79.133.46.247:3000/remove?publicKey=${nameToDelete}`);
                    await ctx.answerCbQuery('✅ حذف شد');
                    await ctx.editMessageText(`❌ سرویس "${nameToDelete}" حذف شد.`);
                } catch (err) {
                    await ctx.answerCbQuery('⚠️ خطا در حذف');
                    await ctx.reply(`❌ خطا در حذف سرویس "${nameToDelete}"`);
                }
            }
        });
        // هندل تمام پیام‌های متنی
        this.bot.on('text', async (ctx) => {
            const chatId = ctx.message.chat.id;
            const state = this.userStates.get(chatId);
            const customName = ctx.message.text;

            if (state === 'BUY') {
                try {
                    const res = await axios.get(`http://79.133.46.247:3000/create?publicKey=${customName}`);
                    const config = res.data.replace('79.133.46.247', 'be.jettingwire.xyz');
                    const blob = new Blob([config], { type: 'text/plain;charset=utf-8' });

                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = `${userName}.ovpn`; // نام فایل بر اساس نام کاربر
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);

                    await ctx.replyWithDocument({ source: buffer, filename: `${customName}.ovpn` });
                } catch (err) {
                    await ctx.reply('❌ مشکلی در ساخت سرویس پیش آمد.');
                }
                this.userStates.delete(chatId);
            }

            if (state === 'DELETE') {
                try {
                    await axios.get(`http://79.133.46.247:3000/remove?publicKey=${customName}`);
                    await ctx.reply(`✅ سرویس با نام "${customName}" حذف شد.`);
                } catch (err) {
                    await ctx.reply(`⚠️ خطایی در حذف سرویس رخ داد یا سرویس موجود نیست.`);
                }
                this.userStates.delete(chatId);
            }
        });

        await this.bot.launch();
    }
}
