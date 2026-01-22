// Record each hit note; used for music generation
(function () {
    const noteLog = []; // {t, midi, freq, vel, bubbleId, hand}
  
    function logHit({ t, midi, freq, vel = 0.9, bubbleId, hand }) {
      noteLog.push({ t, midi, freq, vel, bubbleId, hand });
    }
    function clear() { noteLog.length = 0; }
    function get() { return noteLog; }
  
    // For integration with Magenta.js/backend
    function toNoteSequence(bpm = 80) {
      const notes = noteLog.map(n => ({
        pitch: n.midi,
        startTime: Math.max(0, n.t),
        endTime: n.t + 0.18,
        velocity: Math.round((n.vel ?? 0.9) * 100),
        program: 0, // Acoustic Grand Piano
      }));
      const totalTime = notes.length ? notes[notes.length - 1].endTime + 2 : 4;
      return { notes, tempos: [{ time: 0, qpm: bpm }], totalTime };
    }
  
    // (Optional) Download log as JSON
    function downloadJSON(filename = 'noteLog.json') {
      const blob = new Blob([JSON.stringify(noteLog, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: filename });
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    }
  
    window.NoteLog = { logHit, clear, get, toNoteSequence, downloadJSON };
  })();