// Voice Recorder Client-side JavaScript

class VoiceRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;

    this.startBtn = document.getElementById('startBtn');
    this.stopBtn = document.getElementById('stopBtn');
    this.statusEl = document.getElementById('status');
    this.recordingsList = document.getElementById('recordings');

    this.setupEventListeners();
  }

  setupEventListeners() {
    this.startBtn.addEventListener('click', () => this.startRecording());
    this.stopBtn.addEventListener('click', () => this.stopRecording());
  }

  async startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        this.audioChunks.push(event.data);
      };

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
        this.addRecordingToList(audioBlob);
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      this.updateUI();
      this.statusEl.textContent = 'Recording...';
    } catch (error) {
      alert('Error accessing microphone: ' + error.message);
    }
  }

  stopRecording() {
    if (this.mediaRecorder) {
      this.mediaRecorder.stop();
      this.isRecording = false;
      this.updateUI();
      this.statusEl.textContent = 'Recording stopped';
    }
  }

  updateUI() {
    this.startBtn.disabled = this.isRecording;
    this.stopBtn.disabled = !this.isRecording;
  }

  addRecordingToList(audioBlob) {
    const url = URL.createObjectURL(audioBlob);
    const recordingDiv = document.createElement('div');
    recordingDiv.className = 'recording-item';

    const audio = document.createElement('audio');
    audio.src = url;
    audio.controls = true;

    const useBtn = document.createElement('button');
    useBtn.textContent = 'Use';
    useBtn.addEventListener('click', () => {
      // TODO: Send recording to extension
      console.log('Recording selected');
    });

    recordingDiv.appendChild(audio);
    recordingDiv.appendChild(useBtn);
    this.recordingsList.appendChild(recordingDiv);
  }
}

// Initialize when page loads
window.addEventListener('DOMContentLoaded', () => {
  new VoiceRecorder();
});
