(function () {
  const vscode = acquireVsCodeApi ? acquireVsCodeApi() : null;
  const recordBtn = document.getElementById('recordBtn');
  const stopBtn = document.getElementById('stopBtn');
  const playBtn = document.getElementById('playBtn');
  const transcript = document.getElementById('transcript');

  let mediaRecorder;
  let audioChunks = [];

  recordBtn?.addEventListener('click', async () => {
    if (!navigator.mediaDevices) {
      append('Browser recording not available in this WebView');
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = async () => {
      const blob = new Blob(audioChunks, { type: 'audio/wav' });
      const b64 = await blobToBase64(blob);
      vscode.postMessage({ type: 'audio', data: b64 });
      append('Sent audio to extension');
      playBtn.disabled = false;
    };
    mediaRecorder.start();
    recordBtn.disabled = true;
    stopBtn.disabled = false;
    append('Recording...');
  });

  stopBtn?.addEventListener('click', () => {
    mediaRecorder?.stop();
    recordBtn.disabled = false;
    stopBtn.disabled = true;
    append('Stopped recording');
  });

  playBtn?.addEventListener('click', () => {
    vscode.postMessage({ type: 'playTTS', text: transcript.innerText || 'Hello from Jarvis' });
  });

  window.addEventListener('message', event => {
    const msg = event.data;
    if (msg.type === 'transcript') {
      transcript.innerText = msg.text;
    }
  });

  function append(text) {
    transcript.innerText = transcript.innerText + '\n' + text;
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
})();
