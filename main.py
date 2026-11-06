import json
import logging
import os
from threading import Thread
from flask import Flask
from telegram import Update
from telegram.ext import ApplicationBuilder, ChatJoinRequestHandler, CommandHandler, MessageHandler, filters, ContextTypes

web_app = Flask(__name__)

@web_app.route('/')
def home():
    return "Bot is Alive and Running 24/7!"

def run_web():
    port = int(os.environ.get("PORT", 8080))
    web_app.run(host='0.0.0.0', port=port)

def keep_alive():
    t = Thread(target=run_web)
    t.daemon = True
    t.start()

BOT_TOKEN = "9130024533:AAEnz59o8XbZyJ3jK9n_qM_mfycdCm2q0Eg"
ADMIN_ID = 8343576029                     
USERS_FILE = "users.json"
WELCOME_MSG_FILE = "welcome_msg.json"

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

def save_user(user_id):
    users = []
    if os.path.exists(USERS_FILE):
        try:
            with open(USERS_FILE, "r") as f:
                users = json.load(f)
        except:
            users = []
    if user_id not in users:
        users.append(user_id)
        try:
            with open(USERS_FILE, "w") as f:
                json.dump(users, f)
        except Exception as e:
            print(f"Error saving user: {e}")

def get_saved_welcome_messages():
    if os.path.exists(WELCOME_MSG_FILE):
        try:
            with open(WELCOME_MSG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
                elif isinstance(data, dict):
                    return [data]
        except:
            return []
    return []

async def handle_join_request(update: Update, context: ContextTypes.DEFAULT_TYPE):
    request = update.chat_join_request
    user = request.from_user
    user_id = user.id
    user_name = user.first_name or "User"
    
    save_user(user_id)

    welcome_list = get_saved_welcome_messages()
    if welcome_list:
        for welcome_data in welcome_list:
            try:
                msg_type = welcome_data.get("type")
                if msg_type == "text":
                    await context.bot.send_message(chat_id=user_id, text=welcome_data.get('text', ''), disable_web_page_preview=True)
                elif msg_type == "photo":
                    await context.bot.send_photo(chat_id=user_id, photo=welcome_data["file_id"], caption=welcome_data.get("caption", ""))
                elif msg_type == "document":
                    await context.bot.send_document(chat_id=user_id, document=welcome_data["file_id"], caption=welcome_data.get("caption", ""))
            except Exception as e:
                print(f"Error sending welcome: {e}")
    else:
        try:
            await context.bot.send_message(chat_id=user_id, text=f"Hello {user_name}!")
        except Exception as e:
            print(f"Error sending default text: {e}")

async def set_welcome_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        return

    message = update.message
    if message.reply_to_message:
        source_msg = message.reply_to_message
        welcome_data = {}
        
        if source_msg.text:
            welcome_data = {"type": "text", "text": source_msg.text}
        elif source_msg.photo:
            welcome_data = {"type": "photo", "file_id": source_msg.photo[-1].file_id, "caption": source_msg.caption or ""}
        elif source_msg.document:
            welcome_data = {"type": "document", "file_id": source_msg.document.file_id, "caption": source_msg.caption or ""}

        if welcome_data:
            welcome_list = get_saved_welcome_messages()
            welcome_list.append(welcome_data)
            with open(WELCOME_MSG_FILE, "w", encoding="utf-8") as f:
                json.dump(welcome_list, f, ensure_ascii=False)
            await message.reply_text(f"✨ Welcome message added successfully! Total: {len(welcome_list)}")
        else:
            await message.reply_text("❌ Reply to a valid text, photo, or document.")
    else:
        await message.reply_text("❌ Reply to a message with /setwelcome")

async def clear_welcome_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        return
    if os.path.exists(WELCOME_MSG_FILE):
        os.remove(WELCOME_MSG_FILE)
    await update.message.reply_text("🗑️ Welcome messages cleared!")

async def handle_messages(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    message = update.message
    if user.id != ADMIN_ID:
        save_user(user.id)

if __name__ == '__main__':
    keep_alive()
    
    app = ApplicationBuilder().token(BOT_TOKEN).build()
    app.add_handler(ChatJoinRequestHandler(handle_join_request))
    app.add_handler(CommandHandler("setwelcome", set_welcome_command))
    app.add_handler(CommandHandler("clearwelcome", clear_welcome_command))
    app.add_handler(MessageHandler(filters.ALL & ~filters.COMMAND, handle_messages))

    print("Bot started successfully...")
    app.run_polling(drop_pending_updates=True, allowed_updates=Update.ALL_TYPES)
