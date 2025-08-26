const GEMINI_API_KEY = "AIzaSyDXiSHbiz5TvbeIeihIlriHr0h2fVBN4dI";

// Sample news data
const realNews = [
  "Scientists at Stanford University have developed a new renewable energy technology...",
  "The Federal Reserve announced a 0.25% interest rate cut today...",
  "NASA's James Webb Space Telescope has captured unprecedented images...",
  "Local firefighters rescued a family of four from their burning home...",
  "The World Health Organization announced today that global vaccination rates..."
];

const fakeNews = [
  "BREAKING: Government officials confirmed that aliens have been living secretly...",
  "Miracle cure discovered! Local grandmother's secret recipe...",
  "Celebrity actor spotted shape-shifting into a reptilian form...",
  "Scientists create time machine in secret laboratory...",
  "URGENT: 5G towers are secretly mind control devices..."
];

// DOM elements
let newsTextarea;
let checkButton;
let resultSection;
let resultContent;

// Initialize the application
function initApp() {
  document.querySelector('#app').innerHTML = `
    <div class="container">
      <div class="page-grid">
        <aside class="left-rail">
          <div class="rail-card">
            <h3 class="rail-title">About the Project</h3>
            <p class="rail-text">
              This is an AI-powered fake news detector built for a hackathon. 
              It uses a fine-tuned MobileBERT model from Hugging Face Transformers to classify news articles.
            </p>
          </div>

          <div class="rail-card">
            <h3 class="rail-title">How to Use</h3>
            <ul class="rail-steps">
              <li><strong>Enter Text:</strong> Paste a news headline or full article into the text box.</li>
              <li><strong>Analyze:</strong> Click the <em>Check Authenticity</em> button.</li>
              <li><strong>Get Result:</strong> The model predicts if the news is likely real or fake.</li>
            </ul>
          </div>
        </aside>

        <div class="right-content">
          <header class="header">
            <div class="logo"><div class="logo-icon">🤖</div></div>
            <h1 class="title">AI-Powered News Authenticity Checker</h1>
            <p class="subtitle">Enter a news article below to check its authenticity using our ML model.</p>
          </header>
          
          <div class="main-content">
            <div class="card">
              <h2 class="card-title">Try an Example</h2>
              <div class="button-group">
                <button class="btn btn-real" id="load-real-btn">📰 Load Real News</button>
                <button class="btn btn-fake" id="load-fake-btn">🚨 Load Fake News</button>
              </div>
            </div>
            
            <div class="card">
              <div class="input-group">
                <label class="input-label" for="news-text">Enter News Article</label>
                <textarea class="textarea" id="news-text" placeholder="Paste your news article here..." rows="8"></textarea>
              </div>
              <button class="btn btn-check" id="check-btn">🔍 Check Authenticity</button>
            </div>
            
            <div class="card result-section" id="result-section">
              <h2 class="card-title">Analysis Result</h2>
              <div class="result-content" id="result-content"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Get DOM elements
  newsTextarea = document.getElementById('news-text');
  checkButton = document.getElementById('check-btn');
  resultSection = document.getElementById('result-section');
  resultContent = document.getElementById('result-content');

  // Add event listeners
  document.getElementById('load-real-btn').addEventListener('click', loadRealNews);
  document.getElementById('load-fake-btn').addEventListener('click', loadFakeNews);
  checkButton.addEventListener('click', checkAuthenticity);
}

// Load random news
function loadRealNews() {
  const randomIndex = Math.floor(Math.random() * realNews.length);
  newsTextarea.value = realNews[randomIndex];
  hideResult();
}
function loadFakeNews() {
  const randomIndex = Math.floor(Math.random() * fakeNews.length);
  newsTextarea.value = fakeNews[randomIndex];
  hideResult();
}

// --- Gemini Correction Function ---
async function correctWithGemini(fakeText) {
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + GEMINI_API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `This news seems fake: "${fakeText}". 
Please give me this rewritten as corrected factual news. Keep it short, realistic, and to the point.`
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();
    if (data.candidates && data.candidates.length > 0) {
      const parts = data.candidates[0].content.parts;
      if (parts && parts.length > 0) {
        return parts.map(p => p.text).join("\n");
      }
    }
    return "Gemini API did not return corrected news.";
  } catch (err) {
    return "Error fetching corrected news.";
  }
}

// ✅ Updated function to call FastAPI backend
async function checkAuthenticity() {
  const text = newsTextarea.value.trim();
  if (!text) {
    showNotification('Please enter some news text to analyze.', 'warning');
    return;
  }

  // Show loading state
  showLoading();

  try {
    const response = await fetch("http://127.0.0.1:8000/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });

    if (!response.ok) throw new Error("Server error: " + response.status);

    const data = await response.json();

    var prediction = data.label === "REAL" ? "Likely Real" : "Likely Fake";

    // If low confidence → still mark fake but don't show %
    if ((data.confidence * 100).toFixed(2) <= 85) {
      data.label = "FAKE";
      prediction = "Uncertain - Likely Fake";
    }

    let reasoning = [];

    // ✅ If Fake → call Gemini API and show correction
    if (data.label === "FAKE") {
      const corrected = await correctWithGemini(text);
      reasoning.push(`
        <div class="corrected-news-card">
          <h3 class="corrected-title">✅ Corrected News</h3>
          <div class="corrected-body">${corrected.replace(/\n/g, "<br>")}</div>
        </div>
      `);
    }

    showResult(prediction, reasoning);
  } catch (err) {
    showNotification("Error contacting AI server. Please check backend deployment.", "danger");
  }
}

// Show loading state
function showLoading() {
  checkButton.disabled = true;
  checkButton.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      Analyzing with AI...
    </div>
  `;
  hideResult();
}

// Show result (🔴 no confidence percentage now)
function showResult(prediction, reasoning = []) {
  checkButton.disabled = false;
  checkButton.innerHTML = '🔍 Check Authenticity';

  const isReal = prediction === 'Likely Real';

  resultContent.innerHTML = `
    <div>
      <div style="font-size: 1.4rem; margin-bottom: 0.5rem;">${prediction}</div>
      ${reasoning.length > 0 ? `<div style="font-size: 0.95rem; margin-top: 0.8rem;">${reasoning.join('<br>')}</div>` : ''}
    </div>
  `;
  resultContent.className = `result-content ${isReal ? 'result-real' : 'result-fake'}`;
  resultSection.classList.add('show');
}

// Hide result
function hideResult() {
  resultSection.classList.remove('show');
}

// Notifications
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `toast toast-${type}`;
  notification.innerHTML = message;

  notification.style.cssText = `
    position: fixed;
    top: 1.5rem;
    left: 50%;
    transform: translateX(-50%);
    color: #fff;
    padding: 0.5rem 1rem;
    border-radius: 12px;
    font-size: 1rem;
    font-weight: 500;
    z-index: 1000;
    box-shadow: 0 6px 20px rgba(0,0,0,0.2);
    opacity: 0;
    animation: fadeInDown 0.4s ease forwards;
  `;

  switch (type) {
    case 'success':
      notification.style.background = '#28a745'; break;
    case 'danger':
      notification.style.background = '#dc3545'; break;
    case 'warning':
      notification.style.background = '#ffc107'; notification.style.color = '#000'; break;
    default:
      notification.style.background = '#007bff'; break;
  }

  document.body.appendChild(notification);
  setTimeout(() => {
    notification.style.animation = 'fadeOutUp 0.4s ease forwards';
    setTimeout(() => notification.remove(), 400);
  }, 3000);
}

// 🔑 Animations
const style = document.createElement('style');
style.innerHTML = `
@keyframes fadeInDown {
  from { opacity: 0; transform: translate(-50%, -30px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}
@keyframes fadeOutUp {
  from { opacity: 1; transform: translate(-50%, 0); }
  to { opacity: 0; transform: translate(-50%, -30px); }
}
`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', initApp);
