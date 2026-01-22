// js/audio-notes.js  —— Plain script version (no export)
const SCALES = {
    pentatonic_major: [0, 2, 4, 7, 9],
    pentatonic_minor: [0, 3, 5, 7, 10],
  };
  
  function midiToFreq(m){ return 440 * Math.pow(2, (m - 69) / 12); }
  
  function midiName(m){
    const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    return `${names[m % 12]}${Math.floor(m / 12) - 1}`;
  }
  
  // --- seeded RNG ---
  function mulberry32(a){ return function(){ let t=(a+=0x6D2B79F5); t=Math.imul(t^(t>>>15), t|1); t^=t+Math.imul(t^(t>>>7), t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
  function hashToSeed(str){ let h=2166136261>>>0; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0; }
  
  function pickNoteForBubble(id, {
    rootMidi=60, scale='pentatonic_major', octaves=[0,1,2], preferRange=[60,84], rngSeedBase=null
  } = {}){
    const intervals = SCALES[scale] || SCALES.pentatonic_major;
    const seed = (hashToSeed(String(id)) ^ (rngSeedBase ?? 0)) >>> 0;
    const rng = mulberry32(seed);
    const degree = intervals[Math.floor(rng()*intervals.length)];
    const octave = octaves[Math.floor(rng()*octaves.length)];
    let midi = rootMidi + degree + octave*12;
    if (midi < preferRange[0]) midi += 12 * Math.ceil((preferRange[0]-midi)/12);
    if (midi > preferRange[1]) midi -= 12 * Math.ceil((midi-preferRange[1])/12);
    const freq = midiToFreq(midi);
    return { midi, freq, name: midiName(midi), rootMidi, scale };
  }
  
  // ★ Attach to global, for BubbleManager use
  window.AudioNotes = { pickNoteForBubble, midiToFreq, SCALES };