(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const pointers = new Map();
  const input = window.TriadInput = {
    enabled: matchMedia('(pointer: coarse)').matches,
    active: false, x: 0, y: 0, look: 0, lookY: 0, aim: false, fire: false, sprint: false,
    reload: false, fireTap: false, sensitivity: 1,
    reset() {
      pointers.clear();
      this.x = this.y = this.look = this.lookY = 0; this.aim = false;
      this.fire = this.sprint = this.reload = this.fireTap = false;
      $('stick').style.transform = '';
      $('touch-aim').setAttribute('aria-pressed','false');
      document.querySelectorAll('.touch-actions button').forEach(b => b.classList.remove('held'));
    },
    setActive(active) {
      this.active = active;
      this.reset();
      $('touch-controls').hidden = !active || !this.enabled;
      $('pause-button').hidden = !active;
    }
  };
  function configure() {
    document.body.classList.toggle('touch-ui', input.enabled);
    $('touch-toggle').textContent = '터치 조작 ' + (input.enabled ? 'ON' : 'OFF');
    $('touch-toggle').setAttribute('aria-pressed', String(input.enabled));
    input.setActive(input.active);
  }
  $('touch-toggle').onclick = () => { input.enabled = !input.enabled; configure(); };
  $('sensitivity').oninput = e => {
    input.sensitivity = Number(e.target.value);
    $('sensitivity-value').textContent = input.sensitivity.toFixed(1);
  };
  function bind(id, kind) {
    const target = $(id);
    target.addEventListener('pointerdown', e => {
      if (!input.active || !input.enabled || pointers.has(e.pointerId)) return;
      if ([...pointers.values()].some(p => p.kind === kind)) return;
      e.preventDefault();
      target.setPointerCapture(e.pointerId);
      const box = target.getBoundingClientRect();
      pointers.set(e.pointerId, {kind, x: e.clientX, y: e.clientY, centerX: box.left + box.width / 2, centerY: box.top + box.height / 2});
      if (kind === 'fire') { input.fire = true; input.fireTap = true; }
      if (kind === 'sprint') input.sprint = true;
      if (kind === 'reload') input.reload = true;
      if (kind === 'aim') {input.aim=!input.aim;target.setAttribute('aria-pressed',String(input.aim));}
      target.classList.add('held');
      if (kind === 'move') update(e);
    });
    function update(e) {
      const pointer = pointers.get(e.pointerId);
      if (!pointer) return;
      e.preventDefault();
      if (kind === 'move') {
        const dx = e.clientX - pointer.centerX, dy = e.clientY - pointer.centerY;
        const length = Math.hypot(dx, dy), radius = 40;
        input.x = length < 6 ? 0 : dx / Math.max(radius, length);
        input.y = length < 6 ? 0 : -dy / Math.max(radius, length);
        $('stick').style.transform = `translate(${input.x * radius}px, ${-input.y * radius}px)`;
      } else if (kind === 'look' || kind === 'fire') {
        input.look += (e.clientX - pointer.x) * 0.005 * input.sensitivity;
        input.lookY -= (e.clientY - pointer.y) * 0.0035 * input.sensitivity;
        pointer.x = e.clientX; pointer.y=e.clientY;
      }
    }
    function release(e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      if (kind === 'move') { input.x = input.y = 0; $('stick').style.transform = ''; }
      if (kind === 'fire') input.fire = false;
      if (kind === 'sprint') input.sprint = false;
      target.classList.remove('held');
    }
    target.addEventListener('pointermove', update);
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) target.addEventListener(event, release);
    target.addEventListener('contextmenu', e => e.preventDefault());
  }
  bind('joystick', 'move'); bind('look-zone', 'look'); bind('touch-fire', 'fire');
  bind('touch-aim', 'aim'); bind('touch-sprint', 'sprint'); bind('touch-reload', 'reload');
  addEventListener('blur', () => input.reset());
  addEventListener('resize', () => input.reset());
  configure();
})();
