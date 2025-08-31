// DOM Elements
const chatArea = document.getElementById("chatArea");
const userInput = document.getElementById("userInput");
const sendButton = document.getElementById("sendButton");
const micButton = document.getElementById("micButton");
const voiceButton = document.getElementById("voiceButton");
const typingIndicator = document.getElementById("typingIndicator");

// Check if required elements exist
if (!chatArea || !userInput || !sendButton || !micButton) {
    console.error("Chat elements not found. Check your HTML IDs.");
}

// Show typing indicator
function showTyping() {
    if (typingIndicator) {
        typingIndicator.style.display = "block";
        chatArea.scrollTop = chatArea.scrollHeight;
    }
}

// Hide typing indicator
function hideTyping() {
    if (typingIndicator) {
        typingIndicator.style.display = "none";
    }
}

// Add message to chat (also saves to history)
function addMessage(content, isUser) {
    const messageDiv = document.createElement("div");
    messageDiv.className = isUser ? "message user-message" : "message ghost-message";

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    messageDiv.innerHTML = `
        <div class="message-sender">${isUser ? "You" : "Ghost"}</div>
        <div class="message-bubble">${content}</div>
        <div class="message-time">${timeStr}</div>
    `;

    chatArea.appendChild(messageDiv);
    chatArea.scrollTop = chatArea.scrollHeight;
    hideTyping();

    // Save to localStorage (chat history) - debounced
    if (window.saveHistoryTimeout) {
        clearTimeout(window.saveHistoryTimeout);
    }
    window.saveHistoryTimeout = setTimeout(() => {
        const history = JSON.parse(localStorage.getItem("ghostChatHistory") || "[]");
        history.push({ content, isUser, timestamp: Date.now() });
        localStorage.setItem("ghostChatHistory", JSON.stringify(history));
    }, 100);
}

// Load chat history on page load - with error handling
function loadChatHistory() {
    try {
        const history = JSON.parse(localStorage.getItem("ghostChatHistory") || "[]");
        if (history.length === 0) return;

        history.forEach(msg => {
            const messageDiv = document.createElement("div");
            messageDiv.className = msg.isUser ? "message user-message" : "message ghost-message";

            const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            messageDiv.innerHTML = `
                <div class="message-sender">${msg.isUser ? "You" : "Ghost"}</div>
                <div class="message-bubble">${msg.content}</div>
                <div class="message-time">${timeStr}</div>
            `;

            chatArea.appendChild(messageDiv);
        });
        chatArea.scrollTop = chatArea.scrollHeight;
    } catch (e) {
        console.error("Error loading chat history:", e);
        addMessage("❌ Error loading chat history", false);
    }
}

// Text-to-Speech with Improved Voice Selection
const synth = window.speechSynthesis;
let isSpeaking = false;

// Improved voice selection with fallbacks
function getBestVoice() {
    const voices = synth.getVoices();

    // Priority order for voices
    const preferredVoices = [
        { name: 'Google UK English Male', lang: 'en-GB' },
        { name: 'Google US English', lang: 'en-US' },
        { name: 'Microsoft David', lang: 'en-US' },
        { name: 'Samantha', lang: 'en-US' }
    ];

    // Try to find preferred voices
    for (let pref of preferredVoices) {
        const voice = voices.find(v =>
            v.name.includes(pref.name) &&
            v.lang === pref.lang &&
            !v.name.toLowerCase().includes('female')
        );
        if (voice) return voice;
    }

    // Fallback to any good English male voice
    const maleVoice = voices.find(v =>
        v.lang.startsWith('en') &&
        !v.name.toLowerCase().includes('female') &&
        v.name.length > 10
    );

    return maleVoice || voices[0];
}

// Load voices when available
synth.onvoiceschanged = () => {
    console.log("Speech voices loaded:", synth.getVoices().map(v => v.name));
};

// Remove emojis and clean text
function removeEmojis(text) {
    const emojiRegex = /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDD00-\uDDFF]|[\u2000-\u2FFF]|\u00A9|\u00AE|[\u2100-\u214F]|[\u2190-\u21FF]|\u231A|\u231B|\u23E9-\u23EF|\u23F0|\u23F1|\u23F2|\u23F3|\u23F8-\u23FA]|\u24C2|\u25AA|\u25AB|\u25B6|\u25C0|\u25FB-\u25FE]|\u2600-\u26FF]|\u2614|\u2615|\u2648-\u2653]|\u267F|\u2693|\u26A0|\u26A1|\u26AA|\u26AB|\u26BD|\u26BE|\u26C4|\u26C5|\u26CE|\u26CF|\u26D1|\u26D3|\u26D4|\u26E9|\u26EA|\u26F0-\u26FF]|\u2702|\u2705|\u2708-\u270D]|\u270F|\u2712|\u2714|\u2716|\u271D|\u2721|\u2728|\u2733|\u2734|\u2744|\u2747|\u274C|\u274E|\u2753-\u2755]|\u2757|\u2763|\u2764|\u2795-\u2797]|\u27A1|\u27B0|\u27BF|\u2934|\u2935|\u2B05-\u2B07]|\u2B1B|\u2B1C|\u2B50|\u2B55|\u3030|\u303D|\u3297|\u3299]|[\u00A0-\u00FF]|\u2000-\u206F]|\u2122|\u2139|\u3000-\u303F]|[\uD800-\uDBFF][\uDC00-\uDFFF])/g;
    return text.replace(emojiRegex, '').trim();
}

// Speak function with better error handling
function speak(text) {
    if (isSpeaking) synth.cancel();

    const cleanText = removeEmojis(text);
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.voice = getBestVoice();
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1;

    utterance.onstart = () => isSpeaking = true;
    utterance.onend = () => isSpeaking = false;
    utterance.onerror = (e) => {
        console.error("Speech error:", e);
        isSpeaking = false;
    };

    synth.speak(utterance);
}

// Speech Recognition with Improved Accuracy
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let isMicOn = false;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'en-US'; // Changed to en-US for better accuracy
    recognition.interimResults = false; // Changed to false for better accuracy
    recognition.maxAlternatives = 1;
    recognition.continuous = false; // Single recognition per click

    micButton.addEventListener("click", () => {
        isMicOn = !isMicOn;

        if (isMicOn) {
            try {
                recognition.start();
                micButton.innerHTML = "🔴";
                micButton.style.color = "#ff4757";
                userInput.placeholder = "Listening... (Click mic to stop)";
                userInput.disabled = true;
            } catch (e) {
                isMicOn = false;
                micButton.innerHTML = "🎤";
                micButton.style.color = "#aebac1";
                userInput.disabled = false;
                addMessage("❌ Microphone access denied", false);
            }
        } else {
            try {
                recognition.stop();
            } catch (e) {
                console.log("Recognition already stopped");
            }
            micButton.innerHTML = "🎤";
            micButton.style.color = "#aebac1";
            userInput.placeholder = "Type or click mic to speak...";
            userInput.disabled = false;
        }
    });

    recognition.addEventListener("result", (e) => {
        const transcript = Array.from(e.results)
            .map(result => result[0])
            .map(result => result.transcript)
            .join('')
            .trim();

        if (transcript) {
            userInput.value = transcript;
            // Auto-send after recognition
            setTimeout(() => {
                if (isMicOn) {
                    sendMessage();
                }
            }, 500);
        }
    });

    recognition.addEventListener("end", () => {
        if (isMicOn) {
            // Auto-restart for continuous listening
            setTimeout(() => {
                if (isMicOn) {
                    try {
                        recognition.start();
                    } catch (e) {
                        console.log("Could not restart recognition");
                    }
                }
            }, 100);
        } else {
            micButton.innerHTML = "🎤";
            micButton.style.color = "#aebac1";
            userInput.placeholder = "Type or click mic to speak...";
            userInput.disabled = false;
        }
    });

    recognition.addEventListener("error", (event) => {
        console.error("Speech recognition error:", event.error);
        if (isMicOn) {
            addMessage(`❌ Mic error: ${event.error}`, false);
            isMicOn = false;
            micButton.innerHTML = "🎤";
            micButton.style.color = "#aebac1";
            userInput.disabled = false;
        }
    });
} else {
    addMessage("❌ Speech Recognition not supported in your browser.", false);
    micButton.style.display = "none";
}

// Feature List
let featureList = `
✨ <strong>Here's what I can do:</strong><br><br>
✅ <strong>Math Help:</strong> "What is 25 × 17?"<br>
✅ <strong>Time & Date:</strong> "What time is it?"<br>
✅ <strong>Notes:</strong> "Note: Buy milk"<br>
✅ <strong>Timer:</strong> "Set timer for 5 minutes"<br>
✅ <strong>To-Do List:</strong> "Add: Call mom", "Show tasks", "Remove: 1"<br>
✅ <strong>BMI Calculator:</strong> "My weight 60kg, height 160cm"<br>
✅ <strong>Unit Converter:</strong> "5 km in miles", "10 kg to pounds"<br>
✅ <strong>Currency:</strong> "10 USD in INR"<br>
✅ <strong>YouTube Music:</strong> "Play Believer on YouTube"<br>
✅ <strong>QR Code:</strong> "Generate QR for 'Hello'"<br>
✅ <strong>Meditation:</strong> "Start 5-minute meditation"<br>
✅ <strong>Flashcards:</strong> "Teach me 5 Spanish words"<br>
✅ <strong>Jokes & Fun:</strong> "Tell me a joke"<br>
✅ <strong>Reminders:</strong> "Remind me to drink water in 5 min"<br>
✅ <strong>Quiz:</strong> "Let's play quiz", "Start quiz", "Quiz time"<br>
✅ <strong>Rock Paper Scissors:</strong> "Play rps", "RPS", "Let's play a game"<br>
✅ <strong>Stop:</strong> Say "Stop" to cancel anything<br><br>
Just ask me anything! 😊
`.trim();

const featureVoiceMessage = "Here are the things I can help you with!";

// === GENERAL KNOWLEDGE QUIZ QUESTIONS & ANSWERS (with A/B/C/D options) ===
const gkQuiz = [
    {
        question: "What is the capital of India?",
        options: ["A) Mumbai", "B) Kolkata", "C) New Delhi", "D) Chennai"],
        answer: "C"
    },
    {
        question: "Who is known as the Father of the Nation in India?",
        options: ["A) Jawaharlal Nehru", "B) Mahatma Gandhi", "C) Subhas Chandra Bose", "D) Sardar Patel"],
        answer: "B"
    },
    {
        question: "Which planet is known as the Red Planet?",
        options: ["A) Venus", "B) Jupiter", "C) Mars", "D) Saturn"],
        answer: "C"
    },
    {
        question: "What is the largest ocean on Earth?",
        options: ["A) Indian Ocean", "B) Atlantic Ocean", "C) Arctic Ocean", "D) Pacific Ocean"],
        answer: "D"
    },
    {
        question: "Which gas do plants absorb from the atmosphere?",
        options: ["A) Oxygen", "B) Nitrogen", "C) Carbon Dioxide", "D) Hydrogen"],
        answer: "C"
    },
    {
        question: "What is the chemical symbol for water?",
        options: ["A) H2O", "B) CO2", "C) O2", "D) NaCl"],
        answer: "A"
    },
    {
        question: "Which country is known as the Land of the Rising Sun?",
        options: ["A) China", "B) South Korea", "C) Japan", "D) Thailand"],
        answer: "C"
    },
    {
        question: "Who wrote the Indian National Anthem?",
        options: ["A) Rabindranath Tagore", "B) Bankim Chandra Chatterjee", "C) Muhammad Iqbal", "D) Sarojini Naidu"],
        answer: "A"
    },
    {
        question: "How many continents are there in the world?",
        options: ["A) 5", "B) 6", "C) 7", "D) 8"],
        answer: "C"
    },
    {
        question: "What is the longest river in the world?",
        options: ["A) Amazon", "B) Nile", "C) Yangtze", "D) Mississippi"],
        answer: "B"
    }
];

// Open YouTube with better search
function playOnYouTube(query) {
    const cleanQuery = query.replace(/play|song|music|on youtube/gi, "").trim();
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQuery)}`;
    window.open(url, "_blank");
}

// === TASK MANAGER ===
function getTasks() {
    return JSON.parse(localStorage.getItem("ghostTasks") || "[]");
}

function saveTasks(tasks) {
    localStorage.setItem("ghostTasks", JSON.stringify(tasks));
}

// === REMINDER SYSTEM ===
let activeReminders = [];

// Cancel all reminders
function cancelAllReminders() {
    activeReminders.forEach(timerId => clearTimeout(timerId));
    activeReminders = [];
    return "✅ All reminders cancelled.";
}

// === QUIZ SYSTEM (Global Variables) ===
let quizActive = false;
let quizQuestions = [];
let quizIndex = 0;
let quizScore = 0;
let quizTimer;

// Clear quiz timer
function clearQuizTimer() {
    if (quizTimer) clearTimeout(quizTimer);
}

// Start quiz timer (8 seconds for better UX)
function startQuizTimer() {
    clearQuizTimer();
    quizTimer = setTimeout(() => {
        if (quizActive && quizIndex < quizQuestions.length) {
            addMessage(`⏰ Time's up! Correct answer was: ${quizQuestions[quizIndex].answer}`, false);
            quizIndex++;
            if (quizIndex < quizQuestions.length) {
                showNextQuestion();
            } else {
                endQuiz();
            }
        }
    }, 8000); // Reduced from 10 seconds
}

// Show next question
function showNextQuestion() {
    const q = quizQuestions[quizIndex];
    const optionsText = q.options.join("<br>");
    const msg = `🎯 Q${quizIndex + 1}: ${q.question}<br><br>${optionsText}`;
    setTimeout(() => {
        addMessage(msg, false);
        startQuizTimer();
    }, 300); // Reduced delay
}

// End quiz
function endQuiz() {
    quizActive = false;
    clearQuizTimer();
    const msg = `🎉 Quiz Completed!\nYou scored ${quizScore} out of ${quizQuestions.length}.`;
    addMessage(msg, false);
    safeSpeak(`Quiz completed! You scored ${quizScore} out of ${quizQuestions.length}.`);
}

// === ROCK PAPER SCISSORS GAME ===
let rpsGameActive = false;

// === DAILY LIFE CONVERSATIONS ===
const dailyConversations = {
    greetings: [
        "hi", "hello", "hey", "hlo", "namaste", "good morning", "good afternoon",
        "good evening", "sup", "whats up", "howdy", "greetings"
    ],
    howAreYou: [
        "how are you", "how r u", "how are u", "kaise ho", "how are you doing",
        "how you doing", "are you fine", "are you okay"
    ],
    myName: [
        "my name", "who am i", "what is my name", "do you know my name"
    ],
    yourName: [
        "your name", "what is your name", "who are you", "what are you"
    ],
    owner: [
        "your owner", "who made you", "who created you", "who built you",
        "who developed you", "who programmed you"
    ],
    time: [
        "time", "what time", "current time", "tell me time"
    ],
    date: [
        "date", "today", "what date", "current date", "what is today"
    ],
    help: [
        "what can you do", "help", "features", "what can you do", "show features",
        "what are your features", "capabilities", "what can you help me with"
    ],
    stop: [
        "stop", "shut up", "cancel", "quiet", "stop talking", "be quiet", "silence"
    ],
    clear: [
        "clear chat", "clear history", "delete chat", "reset chat"
    ]
};

// Core Logic with Improved Response System
function getResponse(message) {
    const lower = message.toLowerCase().trim();
    const words = lower.split(/\s+/);

    // Stop command
    if (dailyConversations.stop.some(cmd => lower.includes(cmd))) {
        synth.cancel();
        isSpeaking = false;
        return "Okay, I'm stopping right away. 😶";
    }

    // ✅ Clear chat with password
    if (dailyConversations.clear.some(cmd => lower.includes(cmd))) {
        const password = prompt("🔐 Enter password to clear chat:\n\nPassword: Arpit@232422");
        if (password === "Arpit@232422") {
            Array.from(chatArea.children).forEach(child => {
                if (child !== typingIndicator) {
                    child.remove();
                }
            });
            localStorage.removeItem("ghostChatHistory");
            return "✅ All Chats history Cleared successfully.";
        } else {
            return "❌ Incorrect password! Access denied.";
        }
    }

    // Help command
    if (dailyConversations.help.some(cmd => lower.includes(cmd))) {
        addMessage(featureList, false);
        safeSpeak(featureVoiceMessage);
        return;
    }

    // === QUIZ TRIGGERS ===
    const quizTriggers = [
        "let's play quiz", "play quiz", "start quiz", "quiz time", "quiz",
        "i want to play quiz", "take a quiz", "give me a quiz"
    ];

    if (quizTriggers.some(trigger => lower === trigger)) {
        quizActive = true;
        quizScore = 0;
        quizIndex = 0;
        quizQuestions = [...gkQuiz].sort(() => 0.5 - Math.random()).slice(0, 10);
        addMessage("🎯 Quiz Started! 10 questions, 8 seconds each. Let's begin!", false);
        showNextQuestion();
        return;
    }

    // Exit quiz
    if (["exit quiz", "stop quiz", "quit quiz", "end quiz", "leave quiz"].includes(lower)) {
        if (quizActive) {
            quizActive = false;
            clearQuizTimer();
            return "👋 Quiz exited. You can start again anytime!";
        } else {
            return "No quiz is active right now.";
        }
    }

    // Handle quiz answer
    if (quizActive) {
        const ans = message.trim().toUpperCase();
        const correct = quizQuestions[quizIndex].answer;

        clearQuizTimer();

        if (ans === correct) {
            quizScore++;
            addMessage("✅ Correct!", false);
        } else {
            addMessage(`❌ Wrong! Correct answer was: ${correct}`, false);
        }

        quizIndex++;

        if (quizIndex < quizQuestions.length) {
            showNextQuestion();
        } else {
            endQuiz();
        }
        return;
    }

    // === ROCK PAPER SCISSORS GAME ===
    const rpsTriggers = [
        "rps", "rock paper scissors", "play rps", "lets play game", "game",
        "play game", "lets play rps", "play rock paper scissors"
    ];
    if (rpsTriggers.some(trigger => lower === trigger)) {
        rpsGameActive = true;
        return "🎮 Let's play Rock-Paper-Scissors!<br>Choose: <strong>Rock</strong>, <strong>Paper</strong>, or <strong>Scissors</strong>.";
    }

    if (rpsGameActive) {
        const userChoice = lower;
        const choices = ["rock", "paper", "scissors"];
        const botChoice = choices[Math.floor(Math.random() * 3)];

        if (!choices.includes(userChoice)) {
            return "❌ Invalid choice! Choose Rock, Paper, or Scissors.";
        }

        let result;
        if (userChoice === botChoice) {
            result = "It's a tie!";
        } else if (
            (userChoice === "rock" && botChoice === "scissors") ||
            (userChoice === "paper" && botChoice === "rock") ||
            (userChoice === "scissors" && botChoice === "paper")
        ) {
            result = "You win! 🎉";
        } else {
            result = "You lose! 😢";
        }

        rpsGameActive = false;
        return `You: ${userChoice.toUpperCase()}<br>Ghost: ${botChoice.toUpperCase()}<br><br>👉 ${result}`;
    }

    // Greetings
    if (dailyConversations.greetings.some(g => lower.includes(g))) {
        const greetings = [
            "Hi there! I'm Ghost, your AI assistant. How can I help you today?",
            "Hello! I'm Ghost. What can I do for you?",
            "Hey! I'm Ghost. How can I assist you?",
            "Greetings! I'm Ghost. What would you like to know?"
        ];
        return greetings[Math.floor(Math.random() * greetings.length)];
    }

    if (dailyConversations.howAreYou.some(q => lower.includes(q))) {
        const responses = [
            "I'm doing great, thanks! How about you?",
            "I'm fine, thank you! How are you doing?",
            "I'm good! Hope you're having a great day!",
            "Doing well! Thanks for asking. How are you?"
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }

    if (dailyConversations.yourName.some(q => lower.includes(q))) {
        return "I'm Ghost — your AI friend!";
    }

    if (dailyConversations.owner.some(q => lower.includes(q))) {
        return "I'm Ghost — Made By Arpit Pandey!";
    }

    if (dailyConversations.myName.some(q => lower.includes(q))) {
        return "Your Name Is Arpit!";
    }

    // Time & Date
    if (dailyConversations.time.some(q => lower.includes(q))) {
        return `The current time is ${new Date().toLocaleTimeString()}.`;
    }

    if (dailyConversations.date.some(q => lower.includes(q))) {
        return `Today is ${new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`;
    }

    // Math
    if (lower.includes("what is") || lower.includes("solve") || lower.includes("calculate") || lower.includes("=")) {
        const mathRegex = /^([+\-]?(?:\d+\.?\d*|\.\d+)(?:[+\-*/](?:\d+\.?\d*|\.\d+))*)$/;
        const cleanExpr = message.replace(/what is|solve|calculate|=/gi, "").trim();
        if (mathRegex.test(cleanExpr)) {
            try {
                let expr = cleanExpr.replace(/x/g, '*');
                if (/[^0-9+\-*/().\s]/.test(expr)) {
                    return "❌ Invalid characters in math expression.";
                }
                const result = Function('"use strict"; return (' + expr + ')')();
                if (isNaN(result) || !isFinite(result)) {
                    return "❌ Cannot calculate this expression.";
                }
                return `🧮 Result: ${cleanExpr} = ${result}`;
            } catch (e) {
                return "❌ I couldn't solve this math problem.";
            }
        }
    }

    // === REMINDERS ===
    if (lower.includes("remind me") || lower.includes("set reminder") || lower.includes("alert me in") || lower.includes("notify me")) {
        const remindMatch1 = lower.match(/remind me to (.+?) in (\d+) (seconds?|minutes?|hours?)/);
        const remindMatch2 = lower.match(/set a reminder for (\d+) (seconds?|minutes?|hours?)(?: to (.+?))?$/);
        const remindMatch3 = lower.match(/in (\d+) (seconds?|minutes?|hours?) remind me to (.+?)(?:$|\.)/);

        if (remindMatch1 || remindMatch2 || remindMatch3) {
            let task, timeValue, unit;

            if (remindMatch1) {
                [_, task, timeValue, unit] = remindMatch1;
            } else if (remindMatch2) {
                [_, timeValue, unit, task] = remindMatch2;
            } else if (remindMatch3) {
                [_, timeValue, unit, task] = remindMatch3;
            }

            task = task?.trim() || "this task";
            const value = parseInt(timeValue);
            let ms;

            if (unit.startsWith("sec")) ms = value * 1000;
            else if (unit.startsWith("min")) ms = value * 60000;
            else if (unit.startsWith("hour")) ms = value * 3600000;

            const timerId = setTimeout(() => {
                const notificationMsg = `🔔 Reminder: ${task}`;
                addMessage(notificationMsg, false);
                if (voiceEnabled) {
                    speak(notificationMsg);
                }
                // Try to show browser notification
                if (Notification.permission === "granted") {
                    new Notification("Ghost Reminder", { body: task });
                }
            }, ms);

            activeReminders.push(timerId);

            const displayUnit = unit.startsWith("hour") ? "hour" : unit;
            return `✅ I'll remind you to "${task}" in ${value} ${displayUnit}${value !== 1 ? 's' : ''}.`;
        }
    }

    // === TASK MANAGER (To-Do List) ===
    if (lower.startsWith("add:") ||
        lower.includes("add task") ||
        lower.includes("create task") ||
        lower.includes("add new task") ||
        lower.includes("create new task") ||
        lower.includes("make a task")) {
        const task = message.slice(message.indexOf(":") + 1).trim() ||
            message.replace(/add task|create task|add new task|create new task|make a task/gi, "").trim();
        if (!task) return "❌ Please provide a task to add.";

        const tasks = getTasks();
        tasks.push({ text: task, time: new Date().toLocaleString() });
        saveTasks(tasks);
        return `✅ Task added: "${task}"`;
    }

    if (lower.includes("show tasks") ||
        lower.includes("my tasks") ||
        lower.includes("todo") ||
        lower.includes("list tasks") ||
        lower.includes("view tasks")) {
        const tasks = getTasks();
        if (tasks.length === 0) return "📋 No tasks yet. Use 'Add: Task name' to add one.";

        let table = `
            <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 14px;">
                <tr style="background: #2d2d2d; color: white;">
                    <th style="text-align: left;">#</th>
                    <th style="text-align: left;">Task</th>
                    <th style="text-align: left;">Added On</th>
                </tr>
        `;

        tasks.forEach((task, i) => {
            table += `
                <tr style="background: #1e1e1e; border-bottom: 1px solid #3a3a3a;">
                    <td>${i + 1}</td>
                    <td>${task.text}</td>
                    <td>${task.time}</td>
                </tr>
            `;
        });

        table += `</table>`;
        return table;
    }

    // Notes
    if (lower.startsWith("note:") ||
        lower.startsWith("save:") ||
        lower.includes("save note") ||
        lower.includes("add note") ||
        lower.includes("create note")) {
        const note = message.slice(message.indexOf(":") + 1).trim() ||
            message.replace(/save note|add note|create note/gi, "").trim();
        const notes = JSON.parse(localStorage.getItem("ghostNotes") || "[]");
        notes.push({ text: note, time: new Date().toLocaleString() });
        localStorage.setItem("ghostNotes", JSON.stringify(notes));
        return `📝 Note saved: "${note}"`;
    }

    if (lower.includes("my notes") ||
        lower.includes("saved notes") ||
        lower.includes("view notes") ||
        lower.includes("show notes")) {
        const notes = JSON.parse(localStorage.getItem("ghostNotes") || "[]");
        if (notes.length === 0) return "You have no notes yet. Use 'note: your text' to save one!";
        return "📒 Your notes:<br>" + notes.map(n => `• "${n.text}" <small>(${n.time})</small>`).join("<br>");
    }

    // BMI
    if (lower.includes("weight") && lower.includes("height") || lower.includes("bmi") || lower.includes("body mass index")) {
        const weightMatch = lower.match(/weight.*?(\d+(\.\d+)?)/i);
        const heightMatch = lower.match(/height.*?(\d+(\.\d+)?)/i);
        if (weightMatch && heightMatch) {
            const weight = parseFloat(weightMatch[1]);
            let height = parseFloat(heightMatch[1]);
            if (height > 3) height = height / 100;
            const bmi = weight / (height * height);
            const category = bmi < 18.5 ? "Underweight" : bmi < 25 ? "Normal" : bmi < 30 ? "Overweight" : "Obese";
            return `🧮 Your BMI is ${bmi.toFixed(1)} (${category}).`;
        }
    }

    // YouTube Music
    if (lower.includes("play") && (lower.includes("youtube") || lower.includes("song") || lower.includes("music") || lower.includes("listen to"))) {
        const queryMatch = message.match(/play (.+?) on youtube/i);
        const songName = queryMatch ? queryMatch[1] : message.replace(/play|song|music|listen to|on youtube/gi, "").trim();

        if (songName.trim()) {
            setTimeout(() => playOnYouTube(songName), 500);
            return `🎵 Playing "${songName}" on YouTube...`;
        }
    }

    // Default response with better fallback
    const defaultResponses = [
        "I'm here to help! Try asking 'what can you do' to see my features.",
        "I can help you with many things! Ask me about math, time, tasks, or just chat!",
        "I'm your AI assistant! What would you like to know?",
        "I'm ready to help! Try asking me to calculate something or set a reminder."
    ];

    return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
}

// Send Message with Faster Response
function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    addMessage(message, true);
    userInput.value = "";
    showTyping();

    // Faster response time
    setTimeout(() => {
        const response = getResponse(message);
        if (response !== undefined) {
            addMessage(response, false);
            safeSpeak(response);
        }
    }, 300 + Math.random() * 200); // Reduced from 1000ms
}

// === VOICE TOGGLE FEATURE ===
let voiceEnabled = JSON.parse(localStorage.getItem("ghostVoiceEnabled")) !== false;

function updateVoiceButton() {
    if (voiceButton) {
        voiceButton.textContent = voiceEnabled ? "🔊" : "🔇";
        voiceButton.title = voiceEnabled ? "Click to disable voice" : "Click to enable voice";
    }
}

if (voiceButton) {
    voiceButton.addEventListener("click", () => {
        voiceEnabled = !voiceEnabled;
        localStorage.setItem("ghostVoiceEnabled", JSON.stringify(voiceEnabled));
        updateVoiceButton();
        addMessage(`🎙️ Voice output is now ${voiceEnabled ? "ON" : "OFF"}`, false);
    });
}

function safeSpeak(text) {
    if (voiceEnabled && text) {
        speak(text);
    }
}

updateVoiceButton();

// Event Listeners
sendButton.addEventListener("click", sendMessage);
userInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
});

// Request notification permission
if ("Notification" in window) {
    Notification.requestPermission();
}

// Load voices and chat history on first click
document.addEventListener("click", () => {
    if (synth.getVoices().length === 0) {
        synth.getVoices();
    }

    if (!window.chatHistoryLoaded) {
        loadChatHistory();
        window.chatHistoryLoaded = true;

        if (chatArea.children.length <= 1) {
            const welcomeMsg = "Hello! I'm Ghost, your AI assistant. How can I help you today?";
            addMessage(welcomeMsg, false);
        }
    }
}, { once: true });

// Hide typing indicator on load
hideTyping();