// Global DOM elements for the chat interface
const chatArea = document.getElementById("chatArea");
const userInput = document.getElementById("userInput");
const sendButton = document.getElementById("sendButton");
const micButton = document.getElementById("micButton");
const voiceButton = document.getElementById("voiceButton");
const typingIndicator = document.getElementById("typingIndicator");

// Global variables for prompt system handling
// --- Simple conversational states
let awaitingTaskInput = false;
let awaitingReminderInput = false;
let awaitingReminderTime = false;
let tempReminderText = "";

// --- Multi-step 'add contact' state
let awaitingContactName = false;
let awaitingContactPhone = false;
let awaitingContactConfirmation = false;
let tempContact = {};

// --- Multi-step 'add expense' state
let awaitingExpenseDescription = false;
let awaitingExpenseAmount = false;
let awaitingExpenseCategory = false;
let awaitingExpenseMode = false;
let awaitingExpenseConfirmation = false;
let tempExpense = {};

// --- Command queue for multi-command processing
let commandQueue = [];
let isProcessingQueue = false;

// Debounce timer for auto-sending typed messages
let typingTimeout = null;
const TYPING_DELAY = 1000; // Delay in ms before auto-sending

// Check for required DOM elements and log error if missing
if (!chatArea || !userInput || !sendButton || !micButton) {
    console.error("Chat elements not found. Check your HTML IDs.");
}

// Function to display typing indicator in chat area
function showTyping() {
    if (typingIndicator) {
        typingIndicator.style.display = "block";
        chatArea.scrollTop = chatArea.scrollHeight;
    }
}

// Function to hide typing indicator from chat area
function hideTyping() {
    if (typingIndicator) {
        typingIndicator.style.display = "none";
    }
}

// Function to add a message to the chat area and save to history
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

    // Debounced saving of chat history to localStorage
    if (window.saveHistoryTimeout) {
        clearTimeout(window.saveHistoryTimeout);
    }
    window.saveHistoryTimeout = setTimeout(() => {
        const history = JSON.parse(localStorage.getItem("ghostChatHistory") || "[]");
        history.push({ content, isUser, timestamp: Date.now() });
        localStorage.setItem("ghostChatHistory", JSON.stringify(history));
    }, 100);
}

// Function to load chat history from localStorage with error handling
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

// Speech synthesis setup and variables
const synth = window.speechSynthesis;
let isSpeaking = false;

// Platform-specific voices for offline use
const platformVoices = {
    windows: [
        { name: 'David', voiceName: 'Microsoft David Desktop', gender: 'male' },
        { name: 'Zira', voiceName: 'Microsoft Zira Desktop', gender: 'female' }
    ],
    macos: [
        { name: 'Alex', voiceName: 'Alex', gender: 'male' },
        { name: 'Samantha', voiceName: 'Samantha', gender: 'female' }
    ],
    android: [
        { name: 'Google Male', voiceName: 'en-US-Standard-D', gender: 'male' },
        { name: 'Google Female', voiceName: 'en-US-Standard-C', gender: 'female' }
    ],
    ios: [
        { name: 'Siri Male', voiceName: 'Siri Male (English (United States))', gender: 'male' },
        { name: 'Siri Female', voiceName: 'Siri Female (English (United States))', gender: 'female' }
    ],
    default: [
        { name: 'Default Male', voiceName: 'en-US-Standard-D', gender: 'male' },
        { name: 'Default Female', voiceName: 'en-US-Standard-C', gender: 'female' }
    ]
};
let availableVoices = [];
let currentVoiceName = '';

// Function to detect platform based on user agent
function detectPlatform() {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('windows')) return 'windows';
    if (userAgent.includes('macintosh')) return 'macos';
    if (userAgent.includes('android')) return 'android';
    if (userAgent.includes('iphone') || userAgent.includes('ipad')) return 'ios';
    return 'default';
}

// Function to get the preferred voice based on platform and selection
function getPreferredVoice() {
    const voices = synth.getVoices();
    const platform = detectPlatform();
    const platformVoiceList = platformVoices[platform] || platformVoices.default;
    availableVoices = platformVoiceList.map(v => v.name);
    if (!currentVoiceName) {
        currentVoiceName = platformVoiceList[0].voiceName;
    }
    const selectedVoice = voices.find(v => v.name === currentVoiceName);
    return selectedVoice || voices.find(v => v.lang.startsWith('en-')) || voices[0];
}

// Load voices when available
synth.onvoiceschanged = () => {
    const voices = synth.getVoices();
    console.log("Available voices:", voices.map(v => `${v.name} (${v.lang})`));
    if (!currentVoiceName) {
        const platform = detectPlatform();
        currentVoiceName = (platformVoices[platform] || platformVoices.default)[0].voiceName;
    }
};

// Function to remove emojis from text
function removeEmojis(text) {
    const emojiRegex = /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDD00-\uDDFF]|[\u2000-\u2FFF]|\u00A9|\u00AE|[\u2100-\u214F]|[\u2190-\u21FF]|\u231A|\u231B|\u23E9-\u23EF|\u23F0|\u23F1|\u23F2|\u23F3|\u23F8-\u23FA]|\u24C2|\u25AA|\u25AB|\u25B6|\u25C0|\u25FB-\u25FE]|\u2600-\u26FF]|\u2614|\u2615|\u2648-\u2653]|\u267F|\u2693|\u26A0|\u26A1|\u26AA|\u26AB|\u26BD|\u26BE|\u26C4|\u26C5|\u26CE|\u26CF|\u26D1|\u26D3|\u26D4|\u26E9|\u26EA|\u26F0-\u26FF]|\u2702|\u2705|\u2708-\u270D]|\u270F|\u2712|\u2714|\u2716|\u271D|\u2721|\u2728|\u2733|\u2734|\u2744|\u2747|\u274C|\u274E|\u2753-\u2755]|\u2757|\u2763|\u2764|\u2795-\u2797]|\u27A1|\u27B0|\u27BF|\u2934|\u2935|\u2B05-\u2B07]|\u2B1B|\u2B1C|\u2B50|\u2B55|\u3030|\u303D|\u3297|\u3299]|[\u00A0-\u00FF]|\u2000-\u206F]|\u2122|\u2139|\u3000-\u303F]|[\uD800-\uDBFF][\uDC00-\uDFFF])/g;
    return text.replace(emojiRegex, '').trim();
}

// Function to strip HTML tags from text
function stripHtml(html) {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || "";
}

// Function to speak text using speech synthesis
function speak(text) {
    if (isSpeaking || !voiceEnabled) return;
    synth.cancel(); // Cancel any ongoing speech
    isSpeaking = true;
    const textToSpeak = stripHtml(removeEmojis(text));
    if (!textToSpeak) {
        isSpeaking = false;
        return;
    }
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.voice = getPreferredVoice();
    utterance.rate = 0.95; // Slightly slower for natural feel
    utterance.pitch = 1.1; // Slightly higher for clarity
    utterance.volume = 1;
    utterance.onstart = () => {
        isSpeaking = true;
        if (isMicOn && recognition) {
            try {
                recognition.stop(); // Stop recognition when assistant starts speaking
            } catch (e) {
                console.log("Recognition already stopped or error stopping during speech start.", e);
            }
        }
    };
    utterance.onend = () => {
        isSpeaking = false;
        if (isMicOn && recognition) {
            setTimeout(() => {
                if (isMicOn && !isSpeaking) {
                    try {
                        recognition.start(); // Restart recognition only if mic is still on and not speaking
                    } catch (e) {
                        console.log("Could not restart recognition after speech.", e);
                    }
                }
            }, 500);
        }
    };
    utterance.onerror = (e) => {
        console.error("Speech synthesis error:", e);
        isSpeaking = false;
        if (isMicOn) {
            setTimeout(() => {
                if (isMicOn && !isSpeaking) {
                    try {
                        recognition.start();
                    } catch (err) {
                        console.log("Could not restart recognition after speech error.");
                    }
                }
            }, 500);
        }
    };
    synth.speak(utterance);
}

// Function to switch voice
function switchVoice(voiceName) {
    const platform = detectPlatform();
    const voiceList = platformVoices[platform] || platformVoices.default;
    const voice = voiceList.find(v => v.name.toLowerCase() === voiceName.toLowerCase());
    if (voice) {
        currentVoiceName = voice.voiceName;
        const sampleText = "This is a sample in the new voice.";
        addMessage(`🔊 Voice switched to ${voice.name}. Sample: ${sampleText}`, false);
        safeSpeak(sampleText);
    } else {
        addMessage(`❌ Voice "${voiceName}" not available. Use: ${voiceList.map(v => v.name).join(', ')}`, false);
    }
}

// Function to list available voices
function listVoices() {
    const platform = detectPlatform();
    const voiceList = platformVoices[platform] || platformVoices.default;
    return `Available voices: ${voiceList.map(v => v.name).join(', ')}`;
}

// Speech recognition setup and variables
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let isMicOn = false;
if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => {
        if (isSpeaking) {
            synth.cancel(); // Interrupt assistant if it's speaking
        }
    };

    micButton.addEventListener("click", () => {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(() => {
            isMicOn = !isMicOn;
            if (isMicOn) {
                try {
                    if (isSpeaking) {
                        synth.cancel(); // Immediately stop speaking when mic is activated
                    }
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
        }).catch(() => {
            addMessage("Mic permission denied. Please enable it in browser settings.", false);
            micButton.disabled = true;
            micButton.style.color = "#ff4757"; // Indicate disabled
        });
    });
    recognition.addEventListener("result", (e) => {
        const transcript = Array.from(e.results)
            .map(result => result[0])
            .map(result => result.transcript)
            .join('')
            .trim();

        if (transcript) {
            userInput.value = transcript;
            setTimeout(() => {
                if (isMicOn) {
                    sendMessage();
                }
            }, 500);
        }
    });
    recognition.addEventListener("end", () => {
        // Simplified mic restart logic
        if (isMicOn && !isSpeaking) {
            setTimeout(() => {
                if (isMicOn && !isSpeaking) {
                    try {
                        recognition.start();
                    } catch (e) {
                        console.log("Could not restart recognition");
                    }
                }
            }, 500);
        } else {
            if (!isSpeaking) {
                micButton.innerHTML = "🎤";
                micButton.style.color = "#aebac1";
                userInput.placeholder = "Type or click mic to speak...";
                userInput.disabled = false;
            }
        }
    });
    recognition.addEventListener("error", (event) => {
        console.error("Speech recognition error:", event.error);
        if (isMicOn && event.error === 'no-speech') {
            // Auto-disable mic on no-speech error
            isMicOn = false;
            recognition.stop();
            micButton.innerHTML = "🎤";
            micButton.style.color = "#aebac1";
            userInput.placeholder = "Type or click mic to speak...";
            userInput.disabled = false;
            addMessage("🎤 No speech detected, microphone turned off.", false);
        } else if (isMicOn) {
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

// Feature list HTML for displaying capabilities
let featureList = `
✨ <strong>Here's what I can do:</strong><br><br>
✅ <strong>Math Help:</strong> "What is 25 × 17?"<br>
✅ <strong>Time & Date:</strong> "What time is it?"<br>
✅ <strong>Notes:</strong> "Note: Buy milk"<br>
✅ <strong>Timer:</strong> "Set timer for 5 minutes"<br>
✅ <strong>To-Do List:</strong> "Add: Call mom", "Show tasks", "Remove: 1", "Complete: 1"<br>
✅ <strong>BMI Calculator:</strong> "My weight 60kg, height 160cm"<br>
✅ <strong>Unit Converter:</strong> "5 km in miles", "10 kg to pounds"<br>
✅ <strong>Currency:</strong> "10 USD in INR"<br>
✅ <strong>YouTube Music:</strong> "Play Believer on YouTube"<br>
✅ <strong>QR Code:</strong> "Generate QR for 'Hello'"<br>
✅ <strong>Meditation:</strong> "Start 5-minute meditation"<br>
✅ <strong>Flashcards:</strong> "Teach me 5 Spanish words"<br>
✅ <strong>Jokes & Fun:</strong> "Tell me a joke"<br>
✅ <strong>Reminders:</strong> "Remind me to drink water in 5 min", "Clear reminders"<br>
✅ <strong>Quiz:</strong> "Let's play quiz", "Start quiz", "Quiz time"<br>
✅ <strong>Rock Paper Scissors:</strong> "Play rps", "RPS", "Let's play a game" (loops until exit)<br>
✅ <strong>Habit Tracker:</strong> "Track habit: Meditation", "Show habits"<br>
✅ <strong>Expense Manager:</strong> "Add expense: 50 for food", "Show expenses"<br>
✅ <strong>Study Timer:</strong> "Start pomodoro", "25 min study timer"<br>
✅ <strong>Mood Journal:</strong> "Log mood: Happy", "Show mood history"<br>
✅ <strong>Goal Tracker:</strong> "Set goal: Learn JavaScript", "Show goals"<br>
✅ <strong>Contact Manager:</strong> "Add contact: John 1234567890", "Show contacts"<br>
✅ <strong>Password Generator:</strong> "Generate password"<br>
✅ <strong>Daily Planner:</strong> "Plan day: Study 2 hours", "Show daily plan"<br>
✅ <strong>Health Tracker:</strong> "Log water: 500ml", "Show health log"<br>
✅ <strong>Flashcard System:</strong> "Add flashcard: Capital of India - New Delhi"<br>
✅ <strong>Voice Switching:</strong> "Switch voice to David", "List voices"<br>
✅ <strong>Stop:</strong> Say "Stop" to cancel anything<br><br>
Just ask me anything! 😊
`.trim();
const featureVoiceMessage = "Here are the things I can help you with!";

// General knowledge quiz questions with options and answers (Expanded)
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
        question: "What is the largest planet in our solar system?",
        options: ["A) Earth", "B) Mars", "C) Jupiter", "D) Saturn"],
        answer: "C"
    },
    {
        question: "Which element has the chemical symbol 'O'?",
        options: ["A) Gold", "B) Oxygen", "C) Osmium", "D) Oganesson"],
        answer: "B"
    },
    {
        question: "In which year did World War II end?",
        options: ["A) 1943", "B) 1944", "C) 1945", "D) 1946"],
        answer: "C"
    },
    {
        question: "What is the tallest mammal?",
        options: ["A) Elephant", "B) Giraffe", "C) Blue Whale", "D) Hippopotamus"],
        answer: "B"
    },
    {
        question: "Which is the largest ocean on Earth?",
        options: ["A) Atlantic Ocean", "B) Indian Ocean", "C) Arctic Ocean", "D) Pacific Ocean"],
        answer: "D"
    },
    {
        question: "How many bones are in the human body?",
        options: ["A) 206", "B) 208", "C) 210", "D) 300"],
        answer: "A"
    },
    {
        question: "What is the currency of Japan?",
        options: ["A) Yuan", "B) Won", "C) Yen", "D) Ringgit"],
        answer: "C"
    },
    {
        question: "Mount Everest is located in which mountain range?",
        options: ["A) Alps", "B) Rockies", "C) Andes", "D) Himalayas"],
        answer: "D"
    }
];

// Function to shuffle an array using Fisher-Yates algorithm
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Quiz-related variables
let quizActive = false;
let quizScore = 0;
let quizIndex = 0;
let quizQuestions = [];
let quizTimer = null;

// Function to start quiz timer with 10 seconds limit
function startQuizTimer() {
    clearQuizTimer();
    quizTimer = setTimeout(() => {
        if (quizActive && quizIndex < quizQuestions.length) {
            addMessage(`⏰ Time's up! Correct answer was: ${quizQuestions[quizIndex].answer}`, false);
            playWrongSound();
            quizIndex++;
            if (quizIndex < quizQuestions.length) {
                showNextQuestion();
            } else {
                endQuiz();
            }
        }
    }, 10000);
}

// Function to display the next quiz question
function showNextQuestion() {
    const q = quizQuestions[quizIndex];
    const optionsText = q.options.join("<br>");
    const msg = `🎯 Q${quizIndex + 1}: ${q.question}<br><br>${optionsText}`;
    setTimeout(() => {
        addMessage(msg, false);
        startQuizTimer();
    }, 500);
}

// Function to clear the quiz timer
function clearQuizTimer() {
    if (quizTimer) clearTimeout(quizTimer);
}

// Function to end the quiz and display score
function endQuiz() {
    quizActive = false;
    clearQuizTimer();
    const msg = `🎉 Quiz Completed!
You scored ${quizScore} out of ${quizQuestions.length}.`;
    addMessage(msg, false);
    safeSpeak(`Quiz completed! You scored ${quizScore} out of ${quizQuestions.length}.`);
}

// Rock Paper Scissors game variables
let rpsGameActive = false;
let rpsUserScore = 0;
let rpsBotScore = 0;

// Function to get habits from localStorage
function getHabits() {
    return JSON.parse(localStorage.getItem("ghostHabits") || "[]");
}

// Function to save habits to localStorage
function saveHabits(habits) {
    localStorage.setItem("ghostHabits", JSON.stringify(habits));
}

// Function to track a habit for today
function trackHabit(habitName) {
    const habits = getHabits();
    const today = new Date().toDateString();
    const existingHabit = habits.find(h => h.name.toLowerCase() === habitName.toLowerCase());
    if (existingHabit) {
        if (!existingHabit.dates.includes(today)) {
            existingHabit.dates.push(today);
            existingHabit.streak += 1;
        }
    } else {
        habits.push({
            name: habitName,
            dates: [today],
            streak: 1,
            createdAt: new Date().toLocaleString()
        });
    }
    saveHabits(habits);
    return `✅ Habit "${habitName}" tracked for today!`;
}

// Function to display habits in a table
function showHabits() {
    const habits = getHabits();
    if (habits.length === 0) {
        return "📋 No habits tracked yet. Use 'Track habit: Meditation' to start!";
    }
    let table = `
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 14px;">
            <tr style="background: #2d2d2d; color: white;">
                <th style="text-align: left;">Habit</th>
                <th style="text-align: left;">Streak</th>
                <th style="text-align: left;">Last Done</th>
            </tr>
    `;
    habits.forEach(habit => {
        const lastDone = habit.dates.length > 0 ?
            new Date(habit.dates[habit.dates.length - 1]).toLocaleDateString() :
            "Never";
        table += `
            <tr style="background: #1e1e1e; border-bottom: 1px solid #3a3a3a;">
                <td>${habit.name}</td>
                <td>${habit.streak} days</td>
                <td>${lastDone}</td>
            </tr>
        `;
    });
    table += `</table>`;
    return table;
}

// Function to get expenses from localStorage
function getExpenses() {
    return JSON.parse(localStorage.getItem("ghostExpenses") || "[]");
}

// Function to save expenses to localStorage
function saveExpenses(expenses) {
    localStorage.setItem("ghostExpenses", JSON.stringify(expenses));
}

// Function to add an expense entry
function addExpense(expenseData) {
    const expenses = getExpenses();
    const expense = {
        amount: parseFloat(expenseData.amount),
        description: expenseData.description,
        category: expenseData.category,
        mode: expenseData.mode,
        date: new Date().toLocaleString()
    };
    expenses.push(expense);
    saveExpenses(expenses);
    const { amount, description } = expenseData;
    const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    return `✅ Expense added: ₹${amount} for ${description} (${category}, ${mode})<br>📊 Total spent: ₹${total.toFixed(2)}`;
}

// Function to display expenses in a table
function showExpenses() {
    const expenses = getExpenses();
    if (expenses.length === 0) {
        return "💰 No expenses recorded yet. Use 'Add expense: 50 for food' to start!";
    }
    let table = `
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 14px;">
            <tr style="background: #2d2d2d; color: white;">
                <th style="text-align: left;">Amount</th>
                <th style="text-align: left;">Description</th>
                <th style="text-align: left;">Category</th>
                <th style="text-align: left;">Mode</th>
                <th style="text-align: left;">Date</th>
            </tr>
    `;
    let total = 0;
    expenses.forEach(expense => {
        total += expense.amount;
        table += `
            <tr style="background: #1e1e1e; border-bottom: 1px solid #3a3a3a;">
                <td>₹${expense.amount.toFixed(2)}</td>
                <td>${expense.description}</td>
                <td>${expense.category}</td>
                <td>${expense.mode}</td>
                <td>${expense.date}</td>
            </tr>
        `;
    });
    table += `
        <tr style="background: #2d2d2d; color: white; font-weight: bold;">
            <td colspan="4">Total:</td>
            <td>₹${total.toFixed(2)}</td>
        </tr>
    `;
    table += `</table>`;
    return table;
}

let pomodoroTimer = null;
let pomodoroTimeLeft = 0;
let pomodoroEndTime = null;

// Function to start a pomodoro study timer
function startPomodoro(minutes = 25) {
    if (pomodoroTimer) {
        clearInterval(pomodoroTimer); // Use clearInterval for setInterval
    }
    pomodoroTimeLeft = minutes * 60;
    pomodoroEndTime = Date.now() + pomodoroTimeLeft * 1000; // Calculate end time

    const updateTimerDisplay = () => {
        const remainingSeconds = Math.round((pomodoroEndTime - Date.now()) / 1000);
        if (remainingSeconds <= 0) {
            clearInterval(pomodoroTimer);
            pomodoroTimer = null;
            addMessage("⏰ Pomodoro session completed! Time for a break!", false);
            if (Notification.permission === "granted") {
                new Notification("Ghost - Pomodoro", { body: "Pomodoro session completed! Time for a break!" });
            }
            return;
        }
        const mins = Math.floor(remainingSeconds / 60);
        const secs = remainingSeconds % 60;
        // Update a UI element if available, or log to console for now
        // console.log(`Pomodoro: ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
    };

    pomodoroTimer = setInterval(updateTimerDisplay, 1000); // Use setInterval
    updateTimerDisplay(); // Initial call to display immediately
    return `⏱️ Pomodoro timer started for ${minutes} minutes!`;
}

// Function to get mood logs from localStorage
function getMoods() {
    return JSON.parse(localStorage.getItem("ghostMoods") || "[]");
}

// Function to save mood logs to localStorage
function saveMoods(moods) {
    localStorage.setItem("ghostMoods", JSON.stringify(moods));
}

// Function to log a mood entry
function logMood(mood) {
    const moods = getMoods();
    const moodEntry = {
        mood: mood,
        date: new Date().toLocaleString(),
        timestamp: Date.now()
    };
    moods.push(moodEntry);
    saveMoods(moods);
    return `😊 Mood "${mood}" logged successfully!`;
}

// Function to display mood history in a table
function showMoodHistory() {
    const moods = getMoods();
    if (moods.length === 0) {
        return "🎭 No moods logged yet. Use 'Log mood: Happy' to start!";
    }
    moods.sort((a, b) => b.timestamp - a.timestamp);
    let table = `
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 14px;">
            <tr style="background: #2d2d2d; color: white;">
                <th style="text-align: left;">Mood</th>
                <th style="text-align: left;">Date</th>
            </tr>
    `;
    moods.forEach(mood => {
        table += `
            <tr style="background: #1e1e1e; border-bottom: 1px solid #3a3a3a;">
                <td>${mood.mood}</td>
                <td>${mood.date}</td>
            </tr>
        `;
    });
    table += `</table>`;
    return table;
}

// Function to get goals from localStorage
function getGoals() {
    return JSON.parse(localStorage.getItem("ghostGoals") || "[]");
}

// Function to save goals to localStorage
function saveGoals(goals) {
    localStorage.setItem("ghostGoals", JSON.stringify(goals));
}

// Function to set a new goal
function setGoal(goalText) {
    const goals = getGoals();
    const goal = {
        id: Date.now(),
        text: goalText,
        status: "pending",
        createdAt: new Date().toLocaleString()
    };
    goals.push(goal);
    saveGoals(goals);
    return `🎯 Goal set: "${goalText}"`;
}

// Function to mark a goal as complete
function completeGoal(goalId) {
    const goals = getGoals();
    const goalIndex = parseInt(goalId) - 1;
    if (goalIndex >= 0 && goalIndex < goals.length) {
        if (goals[goalIndex].status === "completed") {
            return `🤔 Goal "${goals[goalIndex].text}" is already marked as completed.`;
        }
        goals[goalIndex].status = "completed";
        saveGoals(goals);
        return `🎉 Great job! Goal "${goals[goalIndex].text}" marked as completed.`;
    }
    return "❌ Invalid goal ID. Use 'show goals' to see the list with IDs.";
}

function deleteGoal(goalId) {
    const goals = getGoals();
    const goalIndex = parseInt(goalId) - 1;
    if (goalIndex >= 0 && goalIndex < goals.length) {
        const deletedGoal = goals.splice(goalIndex, 1);
        saveGoals(goals);
        return `🗑️ Goal "${deletedGoal[0].text}" has been deleted.`;
    }
    return "❌ Invalid goal ID. Use 'show goals' to see the list with IDs.";
}

// Function to display goals in a table
function showGoals() {
    const goals = getGoals();
    if (goals.length === 0) {
        return "🎯 No goals set yet. Use 'Set goal: Learn JavaScript' to start!";
    }
    let table = `
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 14px;">
            <tr style="background: #2d2d2d; color: white;">
                <th style="text-align: left;">ID</th>
                <th style="text-align: left;">Goal</th>
                <th style="text-align: left;">Status</th>
                <th style="text-align: left;">Created</th>
            </tr>
    `;
    goals.forEach((goal, index) => {
        const status = goal.status === "completed" ? "✅ Completed" : "⏳ Pending";
        table += `
            <tr style="background: #1e1e1e; border-bottom: 1px solid #3a3a3a;">
                <td>${index + 1}</td>
                <td>${goal.text}</td>
                <td>${status}</td>
                <td>${goal.createdAt}</td>
            </tr>
        `;
    });
    table += `</table>`;
    return table;
}

// Function to get contacts from localStorage
function getContacts() {
    return JSON.parse(localStorage.getItem("ghostContacts") || "[]");
}

// Function to save contacts to localStorage
function saveContacts(contacts) {
    localStorage.setItem("ghostContacts", JSON.stringify(contacts));
}

// Function to add a contact
function addContact(name, phone) {
    const contacts = getContacts();
    const contact = {
        name: name,
        phone: phone,
        createdAt: new Date().toLocaleString()
    };
    contacts.push(contact);
    saveContacts(contacts);
    return `📞 Contact added: ${name} - ${phone}`;
}

// Function to display contacts in a table
function showContacts() {
    const contacts = getContacts();
    if (contacts.length === 0) {
        return "📞 No contacts saved yet. Use 'Add contact: John 1234567890' to start!";
    }
    let table = `
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 14px;">
            <tr style="background: #2d2d2d; color: white;">
                <th style="text-align: left;">Name</th>
                <th style="text-align: left;">Phone</th>
                <th style="text-align: left;">Added</th>
            </tr>
    `;
    contacts.forEach(contact => {
        table += `
            <tr style="background: #1e1e1e; border-bottom: 1px solid #3a3a3a;">
                <td>${contact.name}</td>
                <td>${contact.phone}</td>
                <td>${contact.createdAt}</td>
            </tr>
        `;
    });
    table += `</table>`;
    return table;
}

// Function to generate a random password
function generatePassword(length = 12) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.><>?";
    let password = "";
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `🔑 Generated password: <strong>${password}</strong><br>📋 Copy and save it securely!`;
}

// Function to get daily plan from localStorage
function getDailyPlan() {
    return JSON.parse(localStorage.getItem("ghostDailyPlan") || "[]");
}

// Function to save daily plan to localStorage
function saveDailyPlan(plan) {
    localStorage.setItem("ghostDailyPlan", JSON.stringify(plan));
}

// Function to add a daily plan item
function addPlanItem(item) {
    const plan = getDailyPlan();
    const planItem = {
        text: item,
        completed: false,
        createdAt: new Date().toLocaleString()
    };
    plan.push(planItem);
    saveDailyPlan(plan);
    return `📅 Plan item added: "${item}"`;
}

// Function to display daily plan in a table
function showDailyPlan() {
    const plan = getDailyPlan();
    if (plan.length === 0) {
        return "📅 No daily plan yet. Use 'Plan day: Study 2 hours' to start!";
    }
    let table = `
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 14px;">
            <tr style="background: #2d2d2d; color: white;">
                <th style="text-align: left;">Task</th>
                <th style="text-align: left;">Status</th>
                <th style="text-align: left;">Added</th>
            </tr>
    `;
    plan.forEach(item => {
        const status = item.completed ? "✅ Done" : "⏳ Pending";
        table += `
            <tr style="background: #1e1e1e; border-bottom: 1px solid #3a3a3a;">
                <td>${item.text}</td>
                <td>${status}</td>
                <td>${item.createdAt}</td>
            </tr>
        `;
    });
    table += `</table>`;
    return table;
}

// Function to get health logs from localStorage
function getHealthLogs() {
    return JSON.parse(localStorage.getItem("ghostHealthLogs") || "[]");
}

// Function to save health logs to localStorage
function saveHealthLogs(logs) {
    localStorage.setItem("ghostHealthLogs", JSON.stringify(logs));
}

// Function to log a health activity
function logHealth(activity, amount) {
    const logs = getHealthLogs();
    const log = {
        activity: activity,
        amount: amount,
        date: new Date().toLocaleString()
    };
    logs.push(log);
    saveHealthLogs(logs);
    return `💪 Health log added: ${activity} - ${amount}`;
}

// Function to display health logs in a table
function showHealthLogs() {
    const logs = getHealthLogs();
    if (logs.length === 0) {
        return "💪 No health logs yet. Use 'Log water: 500ml' to start!";
    }
    let table = `
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 14px;">
            <tr style="background: #2d2d2d; color: white;">
                <th style="text-align: left;">Activity</th>
                <th style="text-align: left;">Amount</th>
                <th style="text-align: left;">Date</th>
            </tr>
    `;
    logs.forEach(log => {
        table += `
            <tr style="background: #1e1e1e; border-bottom: 1px solid #3a3a3a;">
                <td>${log.activity}</td>
                <td>${log.amount}</td>
                <td>${log.date}</td>
            </tr>
        `;
    });
    table += `</table>`;
    return table;
}

// Function to get flashcards from localStorage
function getFlashcards() {
    return JSON.parse(localStorage.getItem("ghostFlashcards") || "[]");
}

// Function to save flashcards to localStorage
function saveFlashcards(flashcards) {
    localStorage.setItem("ghostFlashcards", JSON.stringify(flashcards));
}

// Function to add a flashcard
function addFlashcard(question, answer) {
    const flashcards = getFlashcards();
    const flashcard = {
        question: question,
        answer: answer,
        createdAt: new Date().toLocaleString()
    };
    flashcards.push(flashcard);
    saveFlashcards(flashcards);
    return `📚 Flashcard added!<br>❓ ${question}<br>✅ ${answer}`;
}

// Function to display flashcards
function showFlashcards() {
    const flashcards = getFlashcards();
    if (flashcards.length === 0) {
        return "📚 No flashcards yet. Use 'Add flashcard: Capital of India - New Delhi' to start!";
    }
    let cards = "📚 Your Flashcards:<br><br>";
    flashcards.forEach((card, index) => {
        cards += `
            <div style="background: #2d2d2d; padding: 10px; margin: 10px 0; border-radius: 5px;">
                <strong>Card ${index + 1}:</strong><br>
                ❓ <strong>Q:</strong> ${card.question}<br>
                ✅ <strong>A:</strong> ${card.answer}<br>
                <small>Added: ${card.createdAt}</small>
            </div>
        `;
    });
    return cards;
}

// Daily conversation triggers (Expanded)
const dailyConversations = {
    greetings: [
        "hi", "hello", "hey", "hlo", "namaste", "good morning", "good afternoon",
        "good evening", "sup", "whats up", "howdy", "greetings", "yo", "hai", "hii", "heya", "what's up",
        "hi ghost", "hello ghost", "hey there", "holla", "g'day", "good to see you", "nice to meet you", "how do you do", "hi bot", "hello bot"
    ],
    howAreYou: [
        "how are you", "how r u", "how are u", "kaise ho", "how are you doing",
        "how you doing", "are you fine", "are you okay", "how's it going", "how do you do", "kya haal hai", "kaise ho", "how's life", "how have you been",
        "what's up ghost", "how's your day", "you good", "how are things", "how are you feeling", "what's new"
    ],
    myName: [
        "my name", "who am i", "what is my name", "do you know my name", "tell me my name", "what's my name", "can you tell me my name",
        "who am i to you", "what should i call myself", "my identity", "who am i really", "do you know who i am"
    ],
    yourName: [
        "your name", "what is your name", "who are you", "what are you", "identify yourself", "who r u", "what should i call you", "what's your name",
        "tell me about yourself", "who is ghost", "your identity", "what do they call you", "what do you go by"
    ],
    owner: [
        "your owner", "who made you", "who created you", "who built you",
        "who developed you", "who programmed you", "who is your creator", "who is your developer", "who made this ai", "who built this bot",
        "your developer", "your programmer", "who's your boss", "who brought you to life", "who designed you"
    ],
    time: [
        "time", "what time", "current time", "tell me time", "what's the time", "time now", "clock", "what time is it",
        "show me the time", "current hour", "what's the clock saying", "do you know the time", "can you tell me the time", "what hour is it"
    ],
    date: [
        "date", "today", "what date", "current date", "what is today", "what's today's date", "calendar", "what's the date",
        "show me the date", "today's calendar", "what day is it", "can you tell me the date", "current day", "date today"
    ],
    help: [
        "what can you do", "help", "features", "what can you do", "show features",
        "what are your features", "capabilities", "what can you help me with", "commands", "options", "functions", "how can you help me",
        "list commands", "show what you can do", "your abilities", "guide me", "i need help", "assist me"
    ],
    stop: [
        "stop", "shut up", "cancel", "quiet", "stop talking", "be quiet", "silence", "pause", "mute", "enough",
        "halt", "terminate", "cease", "hold on", "that's enough", "please stop", "cut it out", "desist"
    ],
    clear: [
        "clear chat", "clear history", "delete chat", "reset chat", "forget everything", "start over", "erase chat",
        "clear conversation", "wipe chat", "empty chat", "remove all messages", "clear all data", "reset all"
    ]
};

// Function to process the command queue sequentially
async function processCommandQueue() {
    if (isProcessingQueue) {
        return;
    }
    if (commandQueue.length === 0) {
        isProcessingQueue = false; // Ensure it's false when queue is truly empty
        hideTyping();
        return;
    }
    isProcessingQueue = true; // Set to true when starting to process
    const command = commandQueue.shift();

    showTyping();

    // Use a promise to wait for a bit
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 200));

    const response = getResponse(command);
    if (response !== undefined) {
        addMessage(response, false);
        safeSpeak(response);
    }

    // Wait for speech to finish before processing the next command
    if (isSpeaking) {
        await new Promise(resolve => {
            const checkSpeaking = setInterval(() => {
                if (!isSpeaking) {
                    clearInterval(checkSpeaking);
                    resolve();
                }
            }, 100);
        });
    }

    // Add a small delay before next command
    await new Promise(resolve => setTimeout(resolve, 200));

    processCommandQueue(); // Process next command
}


// Core function to generate response based on user message
function getResponse(message) {
    const lower = message.toLowerCase().trim();
    const words = lower.split(/\s+/);

    // Handle awaiting inputs first
    if (awaitingTaskInput) {
        awaitingTaskInput = false;
        const task = message.trim();
        if (!task) return "❌ Please provide a task to add.";
        const tasks = getTasks();
        tasks.push({ text: task, time: new Date().toLocaleString() });
        saveTasks(tasks);
        return `✅ Task added: "${task}"`;
    }
    if (awaitingReminderInput) {
        awaitingReminderInput = false;
        awaitingReminderTime = true;
        tempReminderText = message.trim();
        return `⏰ "${tempReminderText}" When To Remind You? (Example: 5 minutes, 1 hour, tomorrow)`;
    }
    if (awaitingReminderTime) {
        awaitingReminderTime = false;
        const timeText = message.trim();
        let ms = 0;
        let displayTime = "";
        if (timeText.includes("minute") || timeText.includes("min")) {
            const match = timeText.match(/(\d+)/);
            if (match) {
                const minutes = parseInt(match[1]);
                ms = minutes * 60000;
                displayTime = `${minutes} minute${minutes !== 1 ? 's' : ''}`;
            }
        } else if (timeText.includes("hour")) {
            const match = timeText.match(/(\d+)/);
            if (match) {
                const hours = parseInt(match[1]);
                ms = hours * 3600000;
                displayTime = `${hours} hour${hours !== 1 ? 's' : ''}`;
            }
        } else if (timeText.includes("second") || timeText.includes("sec")) {
            const match = timeText.match(/(\d+)/);
            if (match) {
                const seconds = parseInt(match[1]);
                ms = seconds * 1000;
                displayTime = `${seconds} second${seconds !== 1 ? 's' : ''}`;
            }
        } else {
            ms = 300000;
            displayTime = "5 minutes";
        }
        if (ms > 0) {
            const timerId = setTimeout(() => {
                const notificationMsg = `🔔 Reminder: ${tempReminderText}`;
                addMessage(notificationMsg, false);
                if (voiceEnabled) {
                    speak(notificationMsg);
                }
                if (Notification.permission === "granted") {
                    new Notification("Ghost Reminder", { body: tempReminderText });
                }
            }, ms);
            activeReminders.push(timerId);
            const finalText = tempReminderText;
            tempReminderText = "";
            return `✅ I'll remind you "${finalText}" in ${displayTime}.`;
        } else {
            tempReminderText = "";
            return "❌ Invalid time format. Please try again.";
        }
    }

    if (lower.includes("clear reminders") || lower.includes("cancel reminders") || lower.includes("remove reminders") || lower.includes("delete reminders") || lower.includes("stop all reminders")) {
        activeReminders.forEach(timerId => clearTimeout(timerId));
        activeReminders = [];
        return "🗑️ All active reminders have been cleared.";
    }

    // --- Conversational Flows ---
    if (awaitingContactName) {
        awaitingContactName = false;
        tempContact.name = message.trim();
        awaitingContactPhone = true;
        return `Got it. What is ${tempContact.name}'s phone number?`;
    }
    if (awaitingContactPhone) {
        awaitingContactPhone = false;
        tempContact.phone = message.trim();
        awaitingContactConfirmation = true;
        return `Great. I will save the contact:<br><b>Name:</b> ${tempContact.name}<br><b>Phone:</b> ${tempContact.phone}<br>Should I save it? (yes/no)`;
    }
    if (awaitingContactConfirmation) {
        awaitingContactConfirmation = false;
        if (lower === 'yes' || lower === 'y') {
            const response = addContact(tempContact.name, tempContact.phone);
            tempContact = {};
            return response;
        } else {
            tempContact = {};
            return "Okay, I've cancelled adding the contact.";
        }
    }
    if (awaitingExpenseDescription) {
        awaitingExpenseDescription = false;
        tempExpense.description = message.trim();
        awaitingExpenseAmount = true;
        return `And what was the amount for "${tempExpense.description}"?`;
    }
    if (awaitingExpenseAmount) {
        const amount = parseFloat(message.trim());
        if (isNaN(amount)) {
            return "❌ That doesn't seem like a valid amount. Please enter a number.";
        }
        awaitingExpenseAmount = false;
        tempExpense.amount = amount;
        awaitingExpenseCategory = true;
        return `What category does this fall into? (e.g., Food, Travel, Shopping)`;
    }
    if (awaitingExpenseCategory) {
        awaitingExpenseCategory = false;
        tempExpense.category = message.trim();
        awaitingExpenseMode = true;
        return `💳 How did you pay? (e.g., Cash, Card, Wallet, Online)`;
    }
    if (awaitingExpenseMode) {
        awaitingExpenseMode = false;
        tempExpense.mode = message.trim();
        awaitingExpenseConfirmation = true;
        return `Got it. I'm about to add:<br>
            <b>Expense:</b> ${tempExpense.description}<br>
            <b>Amount:</b> ₹${tempExpense.amount}<br>
            <b>Category:</b> ${tempExpense.category}<br>
            <b>Mode:</b> ${tempExpense.mode}<br>
            Is this correct? (yes/no)`;
    }
    if (awaitingExpenseConfirmation) {
        awaitingExpenseConfirmation = false;
        if (lower === 'yes' || lower === 'y') {
            const response = addExpense(tempExpense);
            tempExpense = {};
            return response;
        } else {
            tempExpense = {};
            return "Okay, I've cancelled adding the expense.";
        }
    }


    // Stop command (highest priority)
    if (dailyConversations.stop.some(cmd => lower.includes(cmd))) {
        synth.cancel();
        isSpeaking = false;
        return "Okay, I'm stopping right away. 😶";
    }

    // Clear command
    if (dailyConversations.clear.some(cmd => lower.includes(cmd))) {
        // Removed password check for simplicity and to avoid blocking interaction
        Array.from(chatArea.children).forEach(child => {
            if (child !== typingIndicator) {
                child.remove();
            }
        });
        localStorage.removeItem("ghostChatHistory");
        localStorage.removeItem("ghostTasks"); // Clear tasks as well
        localStorage.removeItem("ghostNotes"); // Clear notes as well
        localStorage.removeItem("ghostHabits"); // Clear habits as well
        localStorage.removeItem("ghostExpenses"); // Clear expenses as well
        localStorage.removeItem("ghostMoods"); // Clear moods as well
        localStorage.removeItem("ghostGoals"); // Clear goals as well
        localStorage.removeItem("ghostContacts"); // Clear contacts as well
        localStorage.removeItem("ghostDailyPlan"); // Clear daily plan as well
        localStorage.removeItem("ghostHealthLogs"); // Clear health logs as well
        localStorage.removeItem("ghostFlashcards"); // Clear flashcards as well

        return "✅ All chat history and stored data cleared successfully.";
    }

    // Help command
    if (dailyConversations.help.some(cmd => lower.includes(cmd))) {
        addMessage(featureList, false);
        safeSpeak(featureVoiceMessage);
        return;
    }

    // Voice switching command
    if (lower.includes("switch voice to")) {
        const voiceMatch = lower.match(/switch voice to (.+)/);
        if (voiceMatch) {
            const requestedVoice = voiceMatch[1].trim();
            switchVoice(requestedVoice);
            return;
        }
    }
    if (lower.includes("list voices")) {
        return listVoices();
    }

    // Habit Tracker
    if (lower.includes("track habit") || lower.includes("log habit") || lower.includes("add habit") || lower.includes("new habit") || lower.includes("set habit")) {
        const habitMatch = message.match(/(?:track|log|add|new|set) habit:?\s*(.+)/i);
        if (habitMatch && habitMatch[1]) {
            return trackHabit(habitMatch[1].trim());
        } else {
            return "❌ Please specify habit name. Example: 'Track habit: Meditation'";
        }
    }
    if (lower.includes("show habits") || lower.includes("view habits") || lower.includes("my habits") || lower.includes("list habits") || lower.includes("what are my habits")) {
        return showHabits();
    }

    // Expense Manager
    if (lower.includes("add expense") || lower.includes("log expense") || lower.includes("new expense") || lower.includes("track expense") || lower.includes("record expense") || lower.includes("record a cost") || lower.includes("expense entry")) {
        const expenseMatch = message.match(/(?:add|log|new|track|record) expense:?\s*(\d+(?:\.\d+)?)\s*(?:for\s*(.+?))?\s*(?:\((\w+)(?:,\s*(\w+))?\))?/i);
        if (expenseMatch && expenseMatch[1]) {
            // For one-shot expense adding
            const amount = parseFloat(expenseMatch[1]);
            const description = expenseMatch[2] ? expenseMatch[2].trim() : 'Unspecified';
            const category = expenseMatch[3] ? expenseMatch[3].trim() : 'Uncategorized';
            const mode = expenseMatch[4] ? expenseMatch[4].trim() : 'Unknown';

            tempExpense = { amount, description, category, mode };
            awaitingExpenseConfirmation = true;
            return `Got it. I'm about to add:<br>
            <b>Expense:</b> ${tempExpense.description}<br>
            <b>Amount:</b> ₹${tempExpense.amount}<br>
            <b>Category:</b> ${tempExpense.category}<br>
            <b>Mode:</b> ${tempExpense.mode}<br>
            Is this correct? (yes/no)`;
        } else {
            // Start conversational flow
            awaitingExpenseDescription = true;
            return "Okay, what was the expense for?";
        }
    }
    if (lower.includes("show expenses") || lower.includes("view expenses") || lower.includes("my expenses") || lower.includes("what are my expenses") || lower.includes("list expenses") || lower.includes("expense report") || lower.includes("check expenses") || lower.includes("all expenses")) {
        return showExpenses();
    }

    // Pomodoro Timer
    if (lower.includes("start pomodoro") || lower.includes("pomodoro timer") || lower.includes("set pomodoro") || lower.includes("begin pomodoro") || lower.includes("pomodoro start")) {
        const timeMatch = message.match(/(\d+)\s*(?:min|minute|minutes)/i);
        const minutes = timeMatch ? parseInt(timeMatch[1]) : 25;
        return startPomodoro(minutes);
    }
    if (lower.includes("study timer") || lower.includes("focus timer") || lower.includes("set study timer") || lower.includes("start focus time")) {
        const timeMatch = message.match(/(\d+)\s*(?:min|minute|minutes)/i);
        const minutes = timeMatch ? parseInt(timeMatch[1]) : 25;
        return startPomodoro(minutes);
    }

    // Mood Journal
    if (lower.includes("log mood") || lower.includes("track mood") || lower.includes("add mood") || lower.includes("how am i feeling") || lower.includes("my mood today")) {
        const moodMatch = message.match(/(?:log|track|add) mood:?\s*(.+)/i);
        if (moodMatch && moodMatch[1]) {
            return logMood(moodMatch[1].trim());
        } else {
            return "❌ Please specify your mood. Example: 'Log mood: Happy'";
        }
    }
    if (lower.includes("show mood") || lower.includes("view mood") || lower.includes("mood history") || lower.includes("my moods") || lower.includes("how have i been feeling")) {
        return showMoodHistory();
    }

    // Goal Management
    if (lower.startsWith("complete goal") || lower.startsWith("finish goal") || lower.startsWith("mark goal as complete") || lower.includes("goal done") || lower.includes("achieve goal")) {
        const match = lower.match(/(?:complete|finish|mark) goal(?: as complete)?\s*(\d+)/);
        if (match && match[1]) {
            return completeGoal(match[1]);
        }
        return "❌ Please provide a goal ID. Example: 'complete goal 1'";
    }
    if (lower.startsWith("delete goal") || lower.startsWith("remove goal") || lower.includes("erase goal") || lower.includes("discard goal")) {
        const match = lower.match(/(?:delete|remove) goal\s*(\d+)/);
        if (match && match[1]) {
            return deleteGoal(match[1]);
        }
        return "❌ Please provide a goal ID. Example: 'delete goal 1'";
    }

    // Goal Tracker
    if (lower.includes("set goal") || lower.includes("add goal") || lower.includes("create goal") || lower.includes("new goal") || lower.includes("plan goal") || lower.includes("establish goal") || lower.includes("define goal")) {
        const goalMatch = message.match(/(?:set|add|create|new|plan|establish|define) goal:?\s*(.+)/i);
        if (goalMatch && goalMatch[1]) {
            return setGoal(goalMatch[1].trim());
        } else {
            return "❌ Please specify your goal. Example: 'Set goal: Learn JavaScript'";
        }
    }
    if (lower.includes("show goals") || lower.includes("view goals") || lower.includes("my goals") || lower.includes("what are my goals") || lower.includes("list goals") || lower.includes("goal list") || lower.includes("current goals") || lower.includes("display goals")) {
        return showGoals();
    }

    // Contact Manager
    if (lower.includes("add contact") || lower.includes("new contact") || lower.includes("save contact") || lower.includes("create contact") || lower.includes("store contact") || lower.includes("add phone number")) {
        const contactMatch = message.match(/add contact:?\s*(.+?)\s+(\d+)/i);
        if (contactMatch && contactMatch[1] && contactMatch[2]) {
            // For one-shot contact adding
            tempContact = {
                name: contactMatch[1],
                phone: contactMatch[2]
            };
            awaitingContactConfirmation = true;
            return `Great. I will save the contact:<br><b>Name:</b> ${tempContact.name}<br><b>Phone:</b> ${tempContact.phone}<br>Should I save it? (yes/no)`;
        } else {
            awaitingContactName = true;
            return "Sure, what is the name of the contact?";
        }
    }
    if (lower.includes("show contacts") || lower.includes("view contacts") || lower.includes("my contacts") || lower.includes("contact list") || lower.includes("list contacts") || lower.includes("who are my contacts") || lower.includes("contacts")) {
        return showContacts();
    }

    // Password Generator
    if (lower.includes("generate password") || lower.includes("create password") || lower.includes("make password") || lower.includes("suggest password") || lower.includes("need a password")) {
        return generatePassword();
    }

    // Daily Planner
    if (lower.includes("plan day") || lower.includes("add plan") || lower.includes("create plan") || lower.includes("new plan") || lower.includes("daily schedule")) {
        const planMatch = message.match(/(?:plan day|add plan|create plan|new plan|daily schedule):?\s*(.+)/i);
        if (planMatch && planMatch[1]) {
            return addPlanItem(planMatch[1].trim());
        } else {
            return "❌ Please specify plan item. Example: 'Plan day: Study 2 hours'";
        }
    }
    if (lower.includes("show plan") || lower.includes("view plan") || lower.includes("daily plan") || lower.includes("my plan") || lower.includes("what's my plan")) {
        return showDailyPlan();
    }

    // Health Tracker
    if (lower.includes("log water") || lower.includes("log health") || lower.includes("add health log") || lower.includes("track health") || lower.includes("record health")) {
        const healthMatch = message.match(/(?:log water|log health|add health log|track health|record health):?\s*(.+)/i);
        if (healthMatch && healthMatch[1]) {
            return logHealth("Water", healthMatch[1].trim());
        } else {
            return "❌ Please specify amount. Example: 'Log water: 500ml'";
        }
    }
    if (lower.includes("show health") || lower.includes("view health") || lower.includes("health log") || lower.includes("my health")) {
        return showHealthLogs();
    }

    // Flashcard System
    if (lower.includes("add flashcard") || lower.includes("create flashcard") || lower.includes("new flashcard") || lower.includes("make flashcard")) {
        const flashcardMatch = message.match(/(?:add flashcard|create flashcard|new flashcard|make flashcard):?\s*(.+?)\s*[-–—]\s*(.+)/i);
        if (flashcardMatch && flashcardMatch[1] && flashcardMatch[2]) {
            return addFlashcard(flashcardMatch[1].trim(), flashcardMatch[2].trim());
        } else {
            return "❌ Please specify question and answer. Example: 'Add flashcard: Capital of India - New Delhi'";
        }
    }
    if (lower.includes("show flashcards") || lower.includes("view flashcards") || lower.includes("my flashcards") || lower.includes("list flashcards") || lower.includes("flashcard list")) {
        return showFlashcards();
    }

    // Quiz
    const quizTriggers = [
        "let's play quiz", "play quiz", "start quiz", "quiz time", "quiz",
        "i want to play quiz", "take a quiz", "give me a quiz", "quiz me", "start a quiz"
    ];
    if (quizTriggers.some(trigger => lower === trigger)) {
        quizActive = true;
        quizScore = 0;
        quizIndex = 0;
        quizQuestions = shuffleArray([...gkQuiz]).slice(0, 10); // Use shuffleArray here
        addMessage("🎯 Quiz Started! 10 questions, 10 seconds each. Let's begin!", false);
        showNextQuestion();
        return;
    }
    if (["exit quiz", "stop quiz", "quit quiz", "end quiz", "leave quiz", "Exit", "stop game", "end game"].some(trigger => lower.includes(trigger))) {
        if (quizActive) {
            quizActive = false;
            clearQuizTimer();
            return "👋 Quiz exited. You can start again anytime!";
        } else {
            return "No quiz is active right now.";
        }
    }
    if (quizActive) {
        const userAnswer = message.trim().toLowerCase();
        const currentQuestion = quizQuestions[quizIndex];
        const correctAnswerLetter = currentQuestion.answer.toLowerCase();

        clearQuizTimer();

        let isCorrect = false;
        const correctOption = currentQuestion.options.find(o => o.toLowerCase().startsWith(correctAnswerLetter + ')'));
        if (correctOption) {
            const correctAnswerText = correctOption.substring(correctOption.indexOf(')') + 1).trim().toLowerCase();
            if (userAnswer === correctAnswerLetter || userAnswer === `option ${correctAnswerLetter}` || userAnswer === correctAnswerText || userAnswer === correctAnswerText.replace(/\s/g, '')) {
                isCorrect = true;
            }
        }

        if (isCorrect) {
            quizScore++;
            addMessage("✅ Correct!", false);
            playCorrectSound();
        } else {
            const correctOptionText = currentQuestion.options.find(o => o.startsWith(currentQuestion.answer)).substring(3);
            addMessage(`❌ Wrong! The correct answer was: ${currentQuestion.answer}) ${correctOptionText}`, false);
            playWrongSound();
        }
        quizIndex++;
        if (quizIndex < quizQuestions.length) {
            showNextQuestion();
        } else {
            endQuiz();
        }
        return;
    }

    // Rock Paper Scissors
    const rpsTriggers = [
        "rps", "rock paper scissors", "play rps", "lets play game", "game",
        "play game", "lets play rps", "play rock paper scissors", "rock paper scissor game", "i am doing great let's play rock paper scissor"
    ];
    if (rpsTriggers.some(trigger => lower === trigger)) {
        rpsGameActive = true;
        rpsUserScore = 0;
        rpsBotScore = 0;
        return `🎮 Let's play Rock-Paper-Scissors! Score: You ${rpsUserScore} - Ghost ${rpsBotScore}<br>Choose: <strong>Rock</strong>, <strong>Paper</strong>, or <strong>Scissors</strong>. Type "exit" to quit.`;
    }
    if (rpsGameActive) {
        if (["exit", "quit", "stop"].includes(lower)) {
            rpsGameActive = false;
            const finalScore = `👋 Game ended! Final Score: You ${rpsUserScore} - Ghost ${rpsBotScore}`;
            rpsUserScore = 0;
            rpsBotScore = 0;
            return finalScore;
        }

        let userChoice = '';
        let remainingText = '';
        const choices = ["rock", "paper", "scissors"];

        // Attempt to extract RPS choice and any remaining commands
        const rpsMatch = lower.match(/^(rock|paper|scissors)(?:\s+(?:and|then|also|&)\s*(.*))?$/i);

        if (rpsMatch) {
            userChoice = rpsMatch[1].toLowerCase();
            remainingText = rpsMatch[2] || '';
        } else if (choices.includes(lower)) {
            userChoice = lower;
        } else {
            // If it's not a valid RPS move and no other commands were parsed, it's an invalid input.
            return "❌ Invalid choice! Choose: Rock, Paper, or Scissors. Type 'exit' to quit.";
        }

        const botChoice = choices[Math.floor(Math.random() * 3)];
        let result;
        if (userChoice === botChoice) {
            result = "It's a tie!";
        } else if (
            (userChoice === "rock" && botChoice === "scissors") ||
            (userChoice === "paper" && botChoice === "rock") ||
            (userChoice === "scissors" && botChoice === "paper")
        ) {
            rpsUserScore++;
            result = "You win! 🎉";
        } else {
            rpsBotScore++;
            result = "You lose! 😢";
        }

        const rpsResponse = `You: ${userChoice.toUpperCase()}<br>Ghost: ${botChoice.toUpperCase()}<br><br>👉 ${result}<br>Score: You ${rpsUserScore} - Ghost ${rpsBotScore}<br>Play again: Choose Rock, Paper, or Scissors. Type 'exit' to quit.`;

        if (remainingText.trim()) {
            const additionalCommands = remainingText.split(/\s+(?:and|then|also|&)\s+/i).filter(c => c.trim() !== '');
            if (additionalCommands.length > 0) {
                // Add the RPS response first, then the additional commands
                commandQueue.unshift(...additionalCommands);
                commandQueue.unshift(rpsResponse);
                if (!isProcessingQueue) {
                    processCommandQueue();
                }
                return; // Return early, let the queue handle the output
            }
        }
        return rpsResponse;
    }

    // Daily Conversations
    if (dailyConversations.greetings.some(g => lower.includes(g))) {
        const greetings = [
            "Hi there! I'm Ghost, your AI assistant. How can I help you today?",
            "Hello! I'm Ghost. What can I do for you?",
            "Hey! I'm Ghost. How can I assist you?",
            "Greetings! I'm Ghost. What would you like to know?",
            "Namaste! I'm Ghost. How can I be of service?",
            "Hey there! I'm Ghost. What's on your mind?"
        ];
        return greetings[Math.floor(Math.random() * greetings.length)];
    }
    if (dailyConversations.howAreYou.some(q => lower.includes(q))) {
        const responses = [
            "I'm doing great, thanks! How about you?",
            "I'm fine, thank you! How are you doing?",
            "I'm good! Hope you're having a great day!",
            "Doing well! Thanks for asking. How are you?",
            "I'm just a program, but I'm here and ready to help! How are you?",
            "I'm doing well, thank you for asking! What can I do for you today?"
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }
    if (dailyConversations.yourName.some(q => lower.includes(q))) {
        return "I'm Ghost — your ai companion!";
    }
    if (dailyConversations.owner.some(q => lower.includes(q))) {
        return "I'm Ghost — Made By Arpit Pandey!";
    }
    if (dailyConversations.myName.some(q => lower.includes(q))) {
        return "Your Name Is Arpit";
    }
    if (dailyConversations.time.some(q => lower.includes(q))) {
        return `The current time is ${new Date().toLocaleTimeString()}.`;
    }
    if (dailyConversations.date.some(q => lower.includes(q))) {
        return `Today is ${new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`;
    }

    // Math calculations
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

    // Reminders
    if (lower.includes("remind me") || lower.includes("set reminder") || lower.includes("alert me in") || lower.includes("notify me") || lower.includes("add reminder") || lower.includes("create reminder") || lower.includes("schedule reminder") || lower.includes("remind me about") || lower.includes("reminder for")) {
        const remindMatch1 = lower.match(/remind me to (.+?) in (\d+) (seconds?|minutes?|hours?)/);
        const remindMatch2 = lower.match(/set a reminder for (\d+) (seconds?|minutes?|hours?)(?: to (.+?))?$/);
        const remindMatch3 = lower.match(/in (\d+) (seconds?|minutes?) remind me to (.+?)(?:$|\.)/);
        const remindMatch4 = lower.match(/reminder for (.+?) in (\d+) (seconds?|minutes?|hours?)/);
        const remindMatch5 = lower.match(/create reminder (.+?) for (\d+) (seconds?|minutes?|hours?)/);
        const remindMatch6 = lower.match(/schedule reminder (.+?) in (\d+) (seconds?|minutes?|hours?)/);

        if (remindMatch1 || remindMatch2 || remindMatch3 || remindMatch4 || remindMatch5 || remindMatch6) {
            let task, timeValue, unit;
            if (remindMatch1) {
                [_, task, timeValue, unit] = remindMatch1;
            } else if (remindMatch2) {
                [_, timeValue, unit, task] = remindMatch2;
            } else if (remindMatch3) {
                [_, timeValue, unit, task] = remindMatch3;
            } else if (remindMatch4) {
                [_, task, timeValue, unit] = remindMatch4;
            } else if (remindMatch5) {
                [_, task, timeValue, unit] = remindMatch5;
            } else if (remindMatch6) {
                [_, task, timeValue, unit] = remindMatch6;
            }
            task = task?.trim() || null;
            if (!task) {
                awaitingReminderInput = true;
                return "🔔 What would you like to set a reminder for?";
            }
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
                if (Notification.permission === "granted") {
                    new Notification("Ghost Reminder", { body: task });
                }
            }, ms);
            activeReminders.push(timerId);
            const displayUnit = unit.startsWith("hour") ? "hour" : unit;
            return `✅ I'll remind you to "${task}" in ${value} ${displayUnit}${value !== 1 ? 's' : ''}.`;
        }
        awaitingReminderInput = true;
        return "🔔 What is the reminder you'd like to set?";
    }

    if (lower.includes("clear reminders") || lower.includes("cancel reminders") || lower.includes("remove reminders") || lower.includes("delete reminders") || lower.includes("stop all reminders")) {
        activeReminders.forEach(timerId => clearTimeout(timerId));
        activeReminders = [];
        return "🗑️ All active reminders have been cleared.";
    }

    // To-Do List (Expanded triggers)
    if (lower.startsWith("add:") ||
        lower.includes("add task") ||
        lower.includes("create task") ||
        lower.includes("add new task") ||
        lower.includes("create new task") ||
        lower.includes("make a task") ||
        lower.includes("add a task") ||
        lower.includes("new todo") ||
        lower.includes("create todo") ||
        lower.includes("add item to list")) {
        const taskMatch = message.match(/(?:add task|create task|add new task|create new task|make a task|add a task|new todo|create todo|add item to list):?\s*(.+)/i) ||
            message.match(/add:(.+)/i);
        let task = taskMatch ? taskMatch[1].trim() :
            message.replace(/add task|create task|add new task|create new task|make a task|add a task|new todo|create todo|add item to list/gi, "").trim();
        if (!task || lower.trim() === "add task" || lower.trim() === "add a task" || lower.trim() === "new todo") {
            awaitingTaskInput = true;
            return "📝 What task should I add?";
        }
        const tasks = getTasks();
        tasks.push({ text: task, time: new Date().toLocaleString(), completed: false });
        saveTasks(tasks);
        return `✅ Task added: "${task}"`;
    }
    if (lower.includes("show tasks") ||
        lower.includes("my tasks") ||
        lower.includes("todo") ||
        lower.includes("list tasks") ||
        lower.includes("view tasks") ||
        lower.includes("tasks") ||
        lower.includes("what are my todos") ||
        lower.includes("display tasks") ||
        lower.includes("check my list")) {
        const tasks = getTasks();
        if (tasks.length === 0) return "📋 No tasks yet. Use 'Add: Task name' to add one.";
        let table = `
            <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 14px;">
                <tr style="background: #2d2d2d; color: white;">
                    <th style="text-align: left;">#</th>
                    <th style="text-align: left;">Task</th>
                    <th style="text-align: left;">Added On</th>
                    <th style="text-align: left;">Status</th>
                </tr>
        `;
        tasks.forEach((task, i) => {
            const status = task.completed ? "✅ Done" : "⏳ Pending";
            table += `
                <tr style="background: #1e1e1e; border-bottom: 1px solid #3a3a3a;">
                    <td>${i + 1}</td>
                    <td>${task.text}</td>
                    <td>${task.time}</td>
                    <td>${status}</td>
                </tr>
            `;
        });
        table += `</table>`;
        return table;
    }

    if (lower.startsWith("complete task") || lower.startsWith("finish task") || lower.startsWith("mark task as complete") || lower.includes("task done") || lower.includes("finish todo")) {
        const match = lower.match(/(?:complete|finish|mark) task(?: as complete)?\s*(\d+)/);
        if (match && match[1]) {
            return completeTask(match[1]);
        }
        return "❌ Please provide a task ID. Example: 'complete task 1'";
    }

    if (lower.startsWith("remove task") || lower.startsWith("delete task") || lower.includes("erase task") || lower.includes("delete todo") || lower.includes("remove todo")) {
        const match = lower.match(/(?:remove|delete) task\s*(\d+)/);
        if (match && match[1]) {
            return removeTask(match[1]);
        }
        return "❌ Please provide a task ID. Example: 'remove task 1'";
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
        const notes = getNotes();
        if (notes.length === 0) return "You have no notes yet. Use 'note: your text' to save one!";
        let table = `
            <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 14px;">
                <tr style="background: #2d2d2d; color: white;">
                    <th style="text-align: left;">ID</th>
                    <th style="text-align: left;">Note</th>
                    <th style="text-align: left;">Added On</th>
                </tr>
        `;
        notes.forEach((note, i) => {
            table += `
                <tr style="background: #1e1e1e; border-bottom: 1px solid #3a3a3a;">
                    <td>${i + 1}</td>
                    <td>${note.text}</td>
                    <td>${note.time}</td>
                </tr>
            `;
        });
        table += `</table>`;
        return table;
    }

    if (lower.startsWith("delete note") || lower.startsWith("remove note")) {
        const match = lower.match(/(?:delete|remove) note\s*(\d+)/);
        if (match && match[1]) {
            return deleteNote(match[1]);
        }
        return "❌ Please provide a note ID. Example: 'delete note 1'";
    }

    if (lower.startsWith("edit note") || lower.startsWith("update note")) {
        const match = lower.match(/(?:edit|update) note\s*(\d+):\s*(.+)/i);
        if (match && match[1] && match[2]) {
            return editNote(match[1], match[2].trim());
        }
        return "❌ Please provide a note ID and new text. Example: 'edit note 1: Buy groceries'";
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

    // YouTube
    if (lower.includes("play") && (lower.includes("youtube") || lower.includes("song") || lower.includes("music") || lower.includes("listen to"))) {
        const queryMatch = message.match(/play (.+?) on youtube/i);
        const songName = queryMatch ? queryMatch[1] : message.replace(/play|song|music|listen to|on youtube/gi, "").trim();
        if (songName.trim()) {
            setTimeout(() => playOnYouTube(songName), 500);
            return `🎵 Playing "${songName}" on YouTube...`;
        }
    }

    // Currency Converter
    if (lower.includes("convert") || lower.includes("exchange") || lower.includes("currency")) {
        const currencyMatch = lower.match(/convert\s*(\d+(?:\.\d+)?)\s*(?:([a-zA-Z$€₹]+)|(?:(usd|inr|eur|dollar|rupees|euro)))\s*(?:to|in)\s*(?:([a-zA-Z$€₹]+)|(?:(usd|inr|eur|dollar|rupees|euro)))/i) ||
            lower.match(/(\d+(?:\.\d+)?)\s*(?:([a-zA-Z$€₹]+)|(?:(usd|inr|eur|dollar|rupees|euro)))\s*(?:in|to)\s*(?:([a-zA-Z$€₹]+)|(?:(usd|inr|eur|dollar|rupees|euro)))/i);
        if (currencyMatch) {
            const amount = parseFloat(currencyMatch[1]);
            let from = (currencyMatch[2] || currencyMatch[3]).toLowerCase();
            let to = (currencyMatch[4] || currencyMatch[5]).toLowerCase();

            from = from.replace('$', 'usd').replace('rs', 'inr').replace('rupees', 'inr').replace('dollar', 'usd').replace('€', 'eur');
            to = to.replace('$', 'usd').replace('rs', 'inr').replace('rupees', 'inr').replace('dollar', 'usd').replace('€', 'eur');

            const rates = { usd: 83.0, inr: 1.0, eur: 90.0 }; // Fixed rates

            if (rates[from] && rates[to]) {
                const result = (amount / rates[from]) * rates[to];
                /* The above code is a JavaScript function that takes in three parameters: `amount`,
                `from`, and `to`. It then calculates an approximate conversion from one currency
                (`from`) to another currency (`to`) based on the given `amount`. The result is
                formatted as a string that includes the original amount, the original currency
                (converted to uppercase), the converted amount (rounded to two decimal places), and
                the target currency (converted to uppercase). */
                return `💰 ${amount} ${from.toUpperCase()} is approximately ${result.toFixed(2)} ${to.toUpperCase()}.`;
            } else {
                return "❌ I can only convert between USD, INR, and EUR for now.";
            }
        }
    }

    // QR Code Generator
    if (lower.startsWith("generate qr") || lower.startsWith("qr code for") || lower.includes("make qr code") || lower.includes("create qr code") || lower.includes("show qr for") || lower.includes("qr me")) {
        const textMatch = lower.match(/(?:generate qr for|qr code for|make qr code for|create qr code for|show qr for|qr me)\s*(.+)/i);
        if (textMatch && textMatch[1]) {
            const data = encodeURIComponent(textMatch[1].trim());
            return `Here is the QR code for "${textMatch[1].trim()}":<br><img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${data}" alt="QR Code">`;
        }
        return "❌ Please specify what the QR code should contain. Example: 'Generate QR for https://google.com'";
    }

    // Default response
    const defaultResponses = [
        "I'm still learning this feature. I'll be able to do this soon. Please try asking 'help' to see what I can do!",
        "That's a bit beyond my current capabilities, but I'm under active development and constantly learning new things. Try asking 'help' for a list of commands.",
        "I'm not sure how to respond to that yet. I'm constantly being updated with new abilities, so stay tuned! You can ask 'help' to see what I can do.",
        "I'm a developing AI and don't have that feature implemented yet. Feel free to ask for 'help' to see my current functionalities."
    ];
    return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
}

// Function to send user message and get response
function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    addMessage(message, true);
    userInput.value = "";

    const inInteractiveMode = quizActive || rpsGameActive || awaitingTaskInput || awaitingReminderInput || awaitingContactName || awaitingExpenseDescription || awaitingContactConfirmation || awaitingExpenseConfirmation;
    const commands = message.split(/\s+(?:and|then|also|&)\s+/i).filter(c => c.trim() !== '');

    if (commands.length > 1 && !inInteractiveMode) {
        commandQueue.push(...commands);
        if (!isProcessingQueue) {
            processCommandQueue();
        }
    } else if (rpsGameActive && commands.length > 0) {
        // If RPS is active, process the first command as RPS input, then queue the rest
        const rpsInput = commands.shift();
        const response = getResponse(rpsInput); // Process RPS input immediately
        if (response !== undefined) {
            addMessage(response, false);
            safeSpeak(response);
        }
        if (commands.length > 0) {
            commandQueue.push(...commands); // Add remaining commands to queue
            if (!isProcessingQueue) {
                processCommandQueue();
            }
        }
    } else {
        showTyping();
        setTimeout(() => {
            const response = getResponse(message);
            if (response !== undefined) {
                addMessage(response, false);
                safeSpeak(response);
            }
        }, 300 + Math.random() * 200);
    }
}

// Voice toggle variables and functions
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
        const voices = synth.getVoices();
        if (voices.length === 0) {
            console.warn("No voices loaded yet, retrying...");
            setTimeout(() => safeSpeak(text), 1000); // Retry after 1000ms
            return;
        }
        speak(text);
    }
}

updateVoiceButton();

// Event listeners for send button and enter key
sendButton.addEventListener("click", sendMessage);
userInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
});

// Auto-send typed messages with debounce
userInput.addEventListener("input", () => {
    if (isMicOn) return; // Don't auto-send while mic is active
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        if (userInput.value.trim() && !isMicOn) {
            sendMessage();
        }
    }, TYPING_DELAY);
});

// Request notification permission if available
if ("Notification" in window) {
    Notification.requestPermission();
}

// Load voices and history on first interaction
document.addEventListener("click", () => {
    if (synth.getVoices().length === 0) {
        synth.getVoices();
    }
    if (!window.chatHistoryLoaded) {
        loadChatHistory();
        window.chatHistoryLoaded = true;
        if (chatArea.children.length <= 1) {
            const welcomeMsg = "Hello! I'm Ghost, How can I help you today?";
            addMessage(welcomeMsg, false);
        }
    }
}, { once: true });

// Hide typing indicator initially
hideTyping();

// Function to adjust app height for mobile devices
(function () {
    function setAppHeight() {
        document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
    }
    setAppHeight();
    window.addEventListener('resize', setAppHeight);
})();

// Placeholder for playOnYouTube function
function playOnYouTube(songName) {
    window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(songName)}`, '_blank');
}

// Function to play a sound (helper)
function playSound(frequency, type, duration = 150, volume = 0.5) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    gainNode.gain.setValueAtTime(volume, audioContext.currentTime);

    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration / 1000);
    oscillator.stop(audioContext.currentTime + duration / 1000);
}

// Function to play correct answer sound
function playCorrectSound() {
    playSound(700, 'sine', 100);
    playSound(900, 'sine', 150, 0.6);
}

// Function to play wrong answer sound
function playWrongSound() {
    playSound(200, 'triangle', 200, 0.7);
    playSound(100, 'triangle', 250, 0.8);
}

// Function to get tasks from localStorage
function getTasks() {
    return JSON.parse(localStorage.getItem("ghostTasks") || "[]");
}

// Function to save tasks to localStorage
function saveTasks(tasks) {
    try {
        localStorage.setItem("ghostTasks", JSON.stringify(tasks));
    } catch (e) {
        console.error("Error saving tasks to localStorage:", e);
        addMessage("❌ Error saving tasks.", false);
    }
}

// Function to complete a task
function completeTask(taskId) {
    const tasks = getTasks();
    const taskIndex = parseInt(taskId) - 1;
    if (taskIndex >= 0 && taskIndex < tasks.length) {
        if (tasks[taskIndex].completed) {
            return `🤔 Task "${tasks[taskIndex].text}" is already marked as completed.`;
        }
        tasks[taskIndex].completed = true;
        saveTasks(tasks);
        return `✅ Task "${tasks[taskIndex].text}" marked as completed.`;
    }
    return "❌ Invalid task ID. Use 'show tasks' to see the list with IDs.";
}

// Function to remove a task
function removeTask(taskId) {
    const tasks = getTasks();
    const taskIndex = parseInt(taskId) - 1;
    if (taskIndex >= 0 && taskIndex < tasks.length) {
        const removedTask = tasks.splice(taskIndex, 1);
        saveTasks(tasks);
        return `🗑️ Task "${removedTask[0].text}" has been removed.`;
    }
    return "❌ Invalid task ID. Use 'show tasks' to see the list with IDs.";
}

// Active reminders array
let activeReminders = [];

// Function to get notes from localStorage
function getNotes() {
    try {
        return JSON.parse(localStorage.getItem("ghostNotes") || "[]");
    } catch (e) {
        console.error("Error loading notes from localStorage:", e);
        return [];
    }
}

// Function to save notes to localStorage
function saveNotes(notes) {
    try {
        localStorage.setItem("ghostNotes", JSON.stringify(notes));
    } catch (e) {
        console.error("Error saving notes to localStorage:", e);
        addMessage("❌ Error saving notes.", false);
    }
}

// Function to delete a note
function deleteNote(noteId) {
    const notes = getNotes();
    const noteIndex = parseInt(noteId) - 1;
    if (noteIndex >= 0 && noteIndex < notes.length) {
        const deletedNote = notes.splice(noteIndex, 1);
        saveNotes(notes);
        return `🗑️ Note "${deletedNote[0].text}" has been deleted.`;
    }
    return "❌ Invalid note ID. Use 'show notes' to see the list with IDs.";
}

// Function to edit a note
function editNote(noteId, newText) {
    const notes = getNotes();
    const noteIndex = parseInt(noteId) - 1;
    if (noteIndex >= 0 && noteIndex < notes.length) {
        notes[noteIndex].text = newText;
        notes[noteIndex].time = new Date().toLocaleString();
        saveNotes(notes);
        return `📝 Note ${noteId} updated to: "${newText}"`;
    }
    return "❌ Invalid note ID. Use 'show notes' to see the list with IDs.";
}
