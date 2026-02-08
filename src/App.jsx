import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Mic, MicOff, LogOut, Settings, MessageCircle, Sparkles, AlertCircle } from 'lucide-react';

const APP_PASSWORD = "sprechen";

const LEVELS = [
  { id: 'A1', name: 'A1 - Начальный', cefr: 'A1', description: 'Простые фразы' },
  { id: 'A2', name: 'A2 - Элементарный', cefr: 'A2', description: 'Базовые темы' },
  { id: 'B1', name: 'B1 - Средний', cefr: 'B1', description: 'Повседневный разговор' },
  { id: 'B2', name: 'B2 - Выше среднего', cefr: 'B2', description: 'Сложные темы' },
  { id: 'C1', name: 'C1 - Продвинутый', cefr: 'C1', description: 'Свободное общение' },
  { id: 'C2', name: 'C2 - Мастер', cefr: 'C2', description: 'Уровень носителя' }
];

export default function GermanAITutor() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [speechRate, setSpeechRate] = useState(0.85);
  const [voiceGender, setVoiceGender] = useState('female'); // female or male
  const [showSettings, setShowSettings] = useState(false);
  
  const [conversation, setConversation] = useState([]);
  const [currentTopic, setCurrentTopic] = useState(null);
  const [aiRole, setAiRole] = useState(null);
  const [errorCount, setErrorCount] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [conversationStarted, setConversationStarted] = useState(false);
  
  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const conversationEndRef = useRef(null);
  const [germanVoice, setGermanVoice] = useState(null);

  useEffect(() => {
    const auth = sessionStorage.getItem('german_ai_auth');
    if (auth === 'true') setIsAuthenticated(true);

    loadVoices();
    if (synthRef.current.onvoiceschanged !== undefined) {
      synthRef.current.onvoiceschanged = loadVoices;
    }
  }, []);

  useEffect(() => {
    loadVoices();
  }, [voiceGender]);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  const loadVoices = () => {
    const voices = synthRef.current.getVoices();
    let voice = null;
    
    if (voiceGender === 'male') {
      voice = voices.find(v => v.lang === 'de-DE' && v.name.toLowerCase().includes('male')) ||
              voices.find(v => v.lang === 'de-DE' && !v.name.toLowerCase().includes('female')) ||
              voices.find(v => v.lang.startsWith('de-'));
    } else {
      voice = voices.find(v => v.lang === 'de-DE' && v.name.toLowerCase().includes('female')) ||
              voices.find(v => v.lang === 'de-DE') ||
              voices.find(v => v.lang.startsWith('de-'));
    }
    
    if (voice) {
      setGermanVoice(voice);
      console.log('Голос:', voice.name, '| Пол:', voiceGender);
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === APP_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem('german_ai_auth', 'true');
      setPassword('');
      setLoginError('');
    } else {
      setLoginError('Неверный пароль');
      setPassword('');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('german_ai_auth');
    resetConversation();
  };

  const resetConversation = () => {
    setConversation([]);
    setConversationStarted(false);
    setSelectedLevel(null);
    setCurrentTopic(null);
    setAiRole(null);
    setErrorCount(0);
  };

  const speak = (text) => {
    return new Promise((resolve) => {
      if (synthRef.current.speaking) synthRef.current.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'de-DE';
      utterance.rate = speechRate;
      utterance.pitch = voiceGender === 'male' ? 0.9 : 1.1;
      utterance.volume = 1.0;
      
      if (germanVoice) utterance.voice = germanVoice;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        resolve();
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        resolve();
      };

      synthRef.current.speak(utterance);
    });
  };

  const callAI = async (userMessage = null, isTopicSelection = false) => {
    setIsThinking(true);
    
    try {
      const messages = [];
      
      // Build conversation history
      if (conversation.length === 0 && !isTopicSelection) {
        // Initial question about topic
        messages.push({
          role: 'user',
          content: `Du bist ein Deutschlehrer für Niveau ${selectedLevel.cefr}. Frage den Schüler auf Deutsch: "Worüber möchten Sie sprechen?" Sei kurz und freundlich.`
        });
      } else {
        // Add system context
        let systemPrompt = `Du bist ein geduldiger Deutschlehrer auf Niveau ${selectedLevel.cefr}.`;
        
        if (currentTopic && aiRole) {
          systemPrompt += ` Du spielst die Rolle von: ${aiRole}. Bleibe in dieser Rolle und stelle nur Fragen zu diesem Thema: "${currentTopic}".`;
        }
        
        systemPrompt += `\n\nWICHTIG:
1. Sprich NUR auf Deutsch
2. Passe Komplexität an ${selectedLevel.cefr} an
3. Wenn der Schüler Fehler macht: erkläre den Fehler auf Russisch, zeige die richtige Form, und bitte um Wiederholung
4. Gib konstruktives Feedback
5. Halte Antworten kurz (1-3 Sätze)
6. Bleibe beim gewählten Thema`;

        // Add conversation history
        conversation.forEach(msg => {
          if (msg.type === 'ai') {
            messages.push({ role: 'assistant', content: msg.text });
          } else if (msg.type === 'user') {
            messages.push({ role: 'user', content: msg.text });
          }
        });
        
        if (userMessage) {
          if (userMessage.toLowerCase().includes('далее') || userMessage.toLowerCase().includes('weiter')) {
            // User wants next question
            messages.push({
              role: 'user',
              content: `Der Schüler sagt "weiter". Stelle eine neue Frage zum Thema "${currentTopic}". ${systemPrompt}`
            });
          } else if (isTopicSelection) {
            // User selected a topic
            messages.push({
              role: 'user',
              content: `Der Schüler möchte über "${userMessage}" sprechen. 
              
1. Erkenne das Thema (Einkaufen, Arzt, Café, Kino, Park, Arbeit, etc.)
2. Nimm die passende Rolle ein (Verkäufer, Arzt, Kellner, etc.)
3. Stelle die erste passende Frage in dieser Rolle
4. Passe an Niveau ${selectedLevel.cefr} an

Antworte NUR mit der ersten Frage auf Deutsch, ohne Erklärungen.`
            });
          } else {
            // Regular user response - check for errors
            messages.push({
              role: 'user',
              content: `Der Schüler hat geantwortet: "${userMessage}"

Prüfe die Antwort auf:
1. Grammatikfehler
2. Aussprachefehler (basierend auf häufigen Fehlern)
3. Wortschatzprobleme

WENN FEHLER:
- Erkläre auf Russisch kurz den Fehler
- Zeige die richtige Form
- Bitte: "Bitte wiederholen Sie: [korrekte Form]"

WENN KORREKT:
- Kurzes Lob ("Sehr gut!", "Prima!")
- Stelle nächste Frage zum Thema "${currentTopic}"

Bleibe in der Rolle: ${aiRole}
Niveau: ${selectedLevel.cefr}
Antworte NUR auf Deutsch (außer Fehlererklärungen auf Russisch).`
            });
          }
        }
      }

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: messages,
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.content && data.content[0]) {
        const aiText = data.content[0].text;
        
        // Check if this is error feedback
        const hasError = aiText.includes('Fehler') || aiText.includes('ошибка') || aiText.includes('Bitte wiederholen');
        
        if (hasError) {
          setErrorCount(prev => prev + 1);
          
          // After 3 errors, offer alternatives
          if (errorCount >= 2) {
            const altText = aiText + "\n\n(Sie haben 3 Fehler gemacht. Möchten Sie über etwas anderes sprechen? Sagen Sie 'Thema wechseln' oder 'Weiter')";
            setConversation(prev => [...prev, {
              type: 'ai',
              text: altText,
              isError: true,
              time: new Date().toLocaleTimeString('ru-RU')
            }]);
            await speak(aiText);
            setErrorCount(0);
          } else {
            setConversation(prev => [...prev, {
              type: 'ai',
              text: aiText,
              isError: true,
              time: new Date().toLocaleTimeString('ru-RU')
            }]);
            await speak(aiText);
          }
        } else {
          setErrorCount(0);
          setConversation(prev => [...prev, {
            type: 'ai',
            text: aiText,
            time: new Date().toLocaleTimeString('ru-RU')
          }]);
          await speak(aiText);
        }
      } else {
        throw new Error('Нет ответа от AI');
      }
      
    } catch (error) {
      console.error('AI Error:', error);
      setConversation(prev => [...prev, {
        type: 'system',
        text: '❌ Ошибка соединения с AI. Проверьте подключение и попробуйте снова.',
        time: new Date().toLocaleTimeString('ru-RU')
      }]);
    } finally {
      setIsThinking(false);
    }
  };

  const startConversation = async () => {
    if (!selectedLevel) return;

    setConversationStarted(true);
    setConversation([{
      type: 'system',
      text: `Уровень: ${selectedLevel.name} | Голос: ${voiceGender === 'male' ? 'Мужской' : 'Женский'}`,
      time: new Date().toLocaleTimeString('ru-RU')
    }]);

    // AI asks what to talk about
    await callAI();
  };

  const getRecognitionTimeout = () => {
    // Slower speech = more time to respond
    if (speechRate < 0.7) return 8000; // 8 seconds
    if (speechRate < 0.85) return 6000; // 6 seconds
    if (speechRate < 1.0) return 5000; // 5 seconds
    return 4000; // 4 seconds
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setConversation(prev => [...prev, {
        type: 'system',
        text: '⚠️ Используйте Chrome или Edge',
        time: new Date().toLocaleTimeString('ru-RU')
      }]);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.lang = 'de-DE';
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = false;

    recognitionRef.current.onstart = () => setIsListening(true);

    recognitionRef.current.onresult = async (event) => {
      const transcript = event.results[0][0].transcript;
      const confidence = event.results[0][0].confidence;
      
      setConversation(prev => [...prev, {
        type: 'user',
        text: transcript,
        confidence: confidence,
        time: new Date().toLocaleTimeString('ru-RU')
      }]);

      // Check if this is topic selection (first user message after system)
      const isFirstResponse = conversation.filter(m => m.type === 'user').length === 0;
      
      if (isFirstResponse && !currentTopic) {
        // User is selecting a topic
        setCurrentTopic(transcript);
        
        // Determine AI role based on topic
        const topicLower = transcript.toLowerCase();
        let role = 'Gesprächspartner';
        
        if (topicLower.includes('einkauf') || topicLower.includes('kaufen') || topicLower.includes('shop')) {
          role = 'Verkäufer';
        } else if (topicLower.includes('arzt') || topicLower.includes('doktor') || topicLower.includes('krank')) {
          role = 'Arzt';
        } else if (topicLower.includes('café') || topicLower.includes('restaurant') || topicLower.includes('essen')) {
          role = 'Kellner';
        } else if (topicLower.includes('kino') || topicLower.includes('film')) {
          role = 'Kinoverkäufer';
        } else if (topicLower.includes('arbeit') || topicLower.includes('job')) {
          role = 'Arbeitskollege';
        }
        
        setAiRole(role);
        await callAI(transcript, true);
      } else {
        // Regular response
        await callAI(transcript, false);
      }
    };

    recognitionRef.current.onerror = (event) => {
      console.error('Recognition error:', event.error);
      setIsListening(false);
      if (event.error === 'no-speech') {
        setConversation(prev => [...prev, {
          type: 'system',
          text: '🎤 Речь не распознана. Попробуйте еще раз.',
          time: new Date().toLocaleTimeString('ru-RU')
        }]);
      }
    };

    recognitionRef.current.onend = () => setIsListening(false);
    recognitionRef.current.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="bg-indigo-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-12 h-12 text-indigo-600" />
            </div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">Deutsch AI Tutor</h1>
            <p className="text-gray-600 text-lg">Умный разговорный немецкий</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setLoginError('');
                }}
                className="w-full px-5 py-4 text-xl border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Пароль"
                autoFocus
              />
              {loginError && <p className="mt-2 text-red-600 text-sm">{loginError}</p>}
            </div>
            
            <button
              type="submit"
              className="w-full bg-indigo-600 text-white py-4 px-6 rounded-xl text-xl font-semibold hover:bg-indigo-700 active:scale-95 transition-all shadow-lg"
            >
              Войти
            </button>
          </form>

          <div className="mt-6 p-4 bg-blue-50 rounded-xl">
            <p className="text-sm text-gray-600 text-center">
              <strong>Пароль:</strong> sprechen
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!conversationStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-3xl shadow-2xl p-8 mb-6">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="bg-indigo-100 p-3 rounded-xl">
                  <Sparkles className="w-8 h-8 text-indigo-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-800">Настройка AI-диалога</h1>
                  <p className="text-gray-600">AI адаптируется под вас и вашу тему</p>
                </div>
              </div>
              <button onClick={handleLogout} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                <LogOut className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">1. Уровень владения немецким</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {LEVELS.map(level => (
                  <button
                    key={level.id}
                    onClick={() => setSelectedLevel(level)}
                    className={`p-4 rounded-xl text-left transition-all ${
                      selectedLevel?.id === level.id
                        ? 'bg-indigo-600 text-white shadow-lg scale-105'
                        : 'bg-gray-50 hover:bg-gray-100 border-2 border-gray-200'
                    }`}
                  >
                    <div className="font-bold text-lg">{level.name}</div>
                    <div className={`text-sm mt-1 ${selectedLevel?.id === level.id ? 'opacity-90' : 'text-gray-600'}`}>
                      {level.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">2. Голос помощника</h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setVoiceGender('female')}
                  className={`p-5 rounded-xl transition-all ${
                    voiceGender === 'female'
                      ? 'bg-pink-600 text-white shadow-lg'
                      : 'bg-gray-50 hover:bg-gray-100 border-2 border-gray-200'
                  }`}
                >
                  <div className="text-2xl mb-2">👩</div>
                  <div className="font-bold">Женский голос</div>
                </button>
                <button
                  onClick={() => setVoiceGender('male')}
                  className={`p-5 rounded-xl transition-all ${
                    voiceGender === 'male'
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'bg-gray-50 hover:bg-gray-100 border-2 border-gray-200'
                  }`}
                >
                  <div className="text-2xl mb-2">👨</div>
                  <div className="font-bold">Мужской голос</div>
                </button>
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">3. Скорость речи</h2>
              <div className="bg-gray-50 p-6 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-lg font-semibold">Скорость: {speechRate.toFixed(2)}x</span>
                  <span className="text-sm text-gray-600">
                    {speechRate < 0.7 ? '🐌 Очень медленно (8с на ответ)' : 
                     speechRate < 0.85 ? '🐢 Медленно (6с на ответ)' : 
                     speechRate < 1.0 ? '👍 Нормально (5с на ответ)' : '🚀 Быстро (4с на ответ)'}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.2"
                  step="0.05"
                  value={speechRate}
                  onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                  className="w-full h-3 bg-indigo-200 rounded-lg appearance-none cursor-pointer"
                  style={{accentColor: '#4f46e5'}}
                />
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>0.5x</span>
                  <span>0.7x</span>
                  <span>0.9x</span>
                  <span>1.2x</span>
                </div>
              </div>
            </div>

            <button
              onClick={startConversation}
              disabled={!selectedLevel}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-5 px-6 rounded-xl text-xl font-bold hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg flex items-center justify-center gap-3"
            >
              <MessageCircle className="w-6 h-6" />
              Начать разговор с AI
              <Sparkles className="w-6 h-6" />
            </button>

            <div className="mt-6 p-5 bg-blue-50 rounded-xl">
              <p className="text-sm text-gray-700">
                <strong>💡 Как это работает:</strong><br/>
                1. AI спросит "О чем хотите поговорить?"<br/>
                2. Вы выбираете тему (покупки, врач, кино, парк...)<br/>
                3. AI берет роль (продавец, доктор...) и ведет диалог<br/>
                4. AI проверяет грамматику и исправляет ошибки<br/>
                5. Скажите "Далее" для следующего вопроса
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-indigo-100 p-3 rounded-xl">
                <MessageCircle className="w-8 h-8 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">AI-разговор</h1>
                <p className="text-gray-600">
                  {selectedLevel.name} 
                  {currentTopic && ` | Тема: ${currentTopic}`}
                  {aiRole && ` | Роль AI: ${aiRole}`}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-3 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <Settings className="w-6 h-6 text-gray-600" />
              </button>
              <button
                onClick={resetConversation}
                className="px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors font-semibold"
              >
                Завершить
              </button>
            </div>
          </div>

          {showSettings && (
            <div className="mt-6 pt-6 border-t">
              <div className="mb-4">
                <label className="block font-semibold mb-2">Голос</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setVoiceGender('female')}
                    className={`px-4 py-2 rounded-lg ${voiceGender === 'female' ? 'bg-pink-600 text-white' : 'bg-gray-200'}`}
                  >
                    👩 Женский
                  </button>
                  <button
                    onClick={() => setVoiceGender('male')}
                    className={`px-4 py-2 rounded-lg ${voiceGender === 'male' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                  >
                    👨 Мужской
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold">Скорость: {speechRate.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="1.2"
                step="0.05"
                value={speechRate}
                onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                className="w-full h-3 bg-indigo-200 rounded-lg appearance-none cursor-pointer"
                style={{accentColor: '#4f46e5'}}
              />
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="h-[500px] overflow-y-auto mb-6 space-y-4 bg-gray-50 rounded-xl p-4">
            {conversation.map((msg, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-xl ${
                  msg.type === 'user'
                    ? 'bg-blue-100 ml-12 border-2 border-blue-200'
                    : msg.type === 'ai'
                    ? msg.isError 
                      ? 'bg-yellow-100 mr-12 border-2 border-yellow-400'
                      : 'bg-green-100 mr-12 border-2 border-green-200'
                    : 'bg-gray-100 border-2 border-gray-200 text-center'
                }`}
              >
                <div className="text-xs text-gray-600 mb-2 font-semibold">
                  {msg.time}
                  {msg.type === 'ai' && ` - AI ${aiRole || 'Lehrer'}`}
                  {msg.type === 'user' && ' - Sie'}
                  {msg.isError && ' ⚠️ Ошибка'}
                </div>
                <div className="text-lg font-medium whitespace-pre-line">{msg.text}</div>
                {msg.confidence && (
                  <div className="text-sm text-gray-600 mt-2">
                    Распознано: {(msg.confidence * 100).toFixed(0)}%
                  </div>
                )}
              </div>
            ))}
            
            {isThinking && (
              <div className="bg-purple-50 p-4 rounded-xl text-center border-2 border-purple-200">
                <div className="flex items-center justify-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-600 animate-pulse" />
                  <span className="text-lg font-medium text-purple-700">AI думает...</span>
                </div>
              </div>
            )}
            
            <div ref={conversationEndRef} />
          </div>

          <div className="flex gap-4">
            {!isListening ? (
              <button
                onClick={startListening}
                disabled={isSpeaking || isThinking}
                className="flex-1 flex items-center justify-center gap-3 px-6 py-5 bg-green-600 text-white rounded-xl text-xl font-bold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-lg"
              >
                <Mic className="w-7 h-7" />
                Ответить
              </button>
            ) : (
              <button
                onClick={stopListening}
                className="flex-1 flex items-center justify-center gap-3 px-6 py-5 bg-red-600 text-white rounded-xl text-xl font-bold hover:bg-red-700 transition-all shadow-lg animate-pulse"
              >
                <MicOff className="w-7 h-7" />
                Стоп
              </button>
            )}

            <button
              onClick={() => {
                const lastAI = [...conversation].reverse().find(m => m.type === 'ai');
                if (lastAI) speak(lastAI.text);
              }}
              disabled={isSpeaking || conversation.length === 0}
              className="px-6 py-5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-lg"
            >
              <Volume2 className="w-7 h-7" />
            </button>
          </div>

          <div className="mt-4 p-4 bg-blue-50 rounded-xl">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-gray-700">
                <strong>Подсказки:</strong><br/>
                • AI проверит грамматику и произношение<br/>
                • После 3 ошибок - предложит сменить тему<br/>
                • Скажите <strong>"Далее"</strong> для следующего вопроса<br/>
                • Скажите <strong>"Тема wechseln"</strong> для смены темы
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
