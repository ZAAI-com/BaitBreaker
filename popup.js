async function detectAPIs() {
  const states = [];
  try { const pa = ('LanguageModel' in self) ? await LanguageModel.availability() : 'unavailable'; states.push(`Prompt: ${pa}`); } catch(e){ states.push('Prompt: error'); }
  try { const sa = ('Summarizer' in self) ? await Summarizer.availability() : 'unavailable'; states.push(`Summarizer: ${sa}`); } catch(e){ states.push('Summarizer: error'); }
  document.getElementById('modelState').textContent = states.join(' · ');
}
detectAPIs();
document.getElementById('preload').onclick = async () => {
  try { if ('LanguageModel' in self) await LanguageModel.create(); } catch(e){}
  try { if ('Summarizer' in self) await Summarizer.create(); } catch(e){}
  detectAPIs();
  log('Preload initiated: model download may continue in the background.');
};
document.getElementById('clear').onclick = async () => { await chrome.runtime.sendMessage({ type: 'BB_CLEAR_CACHE' }); log('Cache cleared.'); };
function log(s){ const el=document.getElementById('log'); el.textContent = s + '\n' + el.textContent; }
