(() => {
  const $ = (id) => document.getElementById(id);
  const input = $('input');
  const sizeEl = $('size');
  const sizeLabel = $('sizeLabel');
  const marginEl = $('margin');
  const marginLabel = $('marginLabel');
  const eccEl = $('ecc');
  const preview = $('preview');
  const emptyHint = $('emptyHint');
  const status = $('status');
  const pngBtn = $('pngBtn');
  const svgBtn = $('svgBtn');
  const copyBtn = $('copyBtn');
  const toast = $('toast');

  let lastSvg = '';
  let lastDataUrl = '';
  let toastTimer = null;

  function showToast(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 1600);
  }

  function setStatus(kind, text) {
    if (!text) {
      status.hidden = true;
      status.textContent = '';
      status.className = 'status';
      return;
    }
    status.hidden = false;
    status.className = 'status ' + kind;
    status.textContent = text;
  }

  function setEnabled(on) {
    pngBtn.disabled = !on;
    svgBtn.disabled = !on;
    copyBtn.disabled = !on;
  }

  function slugName() {
    const t = (input.value || 'qrstamp').trim().slice(0, 32).replace(/[^\w.-]+/g, '-') || 'qrstamp';
    return 'qrstamp-' + t.toLowerCase();
  }

  function download(filename, href) {
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function render() {
    sizeLabel.textContent = sizeEl.value;
    marginLabel.textContent = marginEl.value;

    const text = input.value;
    if (!text.trim()) {
      preview.innerHTML = '';
      emptyHint.hidden = false;
      setEnabled(false);
      lastSvg = '';
      lastDataUrl = '';
      setStatus('', '');
      return;
    }

    emptyHint.hidden = true;

    try {
      if (typeof qrcode !== 'function') {
        throw new Error('QR library failed to load');
      }

      const ecc = eccEl.value || 'M';
      const qr = qrcode(0, ecc);
      qr.addData(text);
      qr.make();

      const size = Number(sizeEl.value) || 256;
      const margin = Number(marginEl.value) || 0;
      const modules = qr.getModuleCount();
      const cell = Math.max(1, Math.floor(size / (modules + margin * 2)));

      lastSvg = qr.createSvgTag({
        cellSize: cell,
        margin: margin,
        scalable: true,
      });

      // Ensure viewBox-friendly width for display
      preview.innerHTML = lastSvg;
      const svg = preview.querySelector('svg');
      if (svg) {
        svg.setAttribute('width', String(size));
        svg.setAttribute('height', String(size));
        svg.style.width = size + 'px';
        svg.style.height = size + 'px';
      }

      lastDataUrl = qr.createDataURL(cell, margin);
      setEnabled(true);
      setStatus('ok', modules + '×' + modules + ' modules · ECC ' + ecc + ' · ' + size + 'px');
    } catch (err) {
      preview.innerHTML = '';
      emptyHint.hidden = false;
      emptyHint.textContent = 'Could not generate QR for this input.';
      setEnabled(false);
      lastSvg = '';
      lastDataUrl = '';
      setStatus('err', (err && err.message) ? err.message : 'Generation failed');
    }
  }

  function downloadPng() {
    if (!lastSvg) return;
    const size = Number(sizeEl.value) || 256;
    const svgBlob = new Blob([lastSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      download(slugName() + '.png', canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      if (lastDataUrl) download(slugName() + '.png', lastDataUrl);
      else showToast('PNG failed');
    };
    img.src = url;
  }

  function downloadSvg() {
    if (!lastSvg) return;
    const blob = new Blob([lastSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    download(slugName() + '.svg', url);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function copyImage() {
    if (!lastSvg) return;
    try {
      const size = Number(sizeEl.value) || 256;
      const svgBlob = new Blob([lastSvg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);

      if (navigator.clipboard && window.ClipboardItem) {
        const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        showToast('Copied image');
      } else {
        throw new Error('Clipboard image not supported');
      }
    } catch (_) {
      try {
        if (lastDataUrl) {
          await navigator.clipboard.writeText(lastDataUrl);
          showToast('Copied data URL');
        } else {
          showToast('Copy failed');
        }
      } catch {
        showToast('Copy failed');
      }
    }
  }

  $('sampleBtn').addEventListener('click', () => {
    input.value = 'https://shaikbasha1437.github.io/qrstamp/';
    render();
  });

  $('clearBtn').addEventListener('click', () => {
    input.value = '';
    emptyHint.textContent = 'Enter text above to generate a QR code.';
    render();
    input.focus();
  });

  pngBtn.addEventListener('click', downloadPng);
  svgBtn.addEventListener('click', downloadSvg);
  copyBtn.addEventListener('click', copyImage);

  let debounce = null;
  function schedule() {
    clearTimeout(debounce);
    debounce = setTimeout(render, 80);
  }

  input.addEventListener('input', schedule);
  sizeEl.addEventListener('input', () => {
    sizeLabel.textContent = sizeEl.value;
    schedule();
  });
  marginEl.addEventListener('input', () => {
    marginLabel.textContent = marginEl.value;
    schedule();
  });
  eccEl.addEventListener('change', render);

  render();
})();
