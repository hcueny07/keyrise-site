// Vinto hero: an interactive night map. Drag to explore (desktop); it drifts on its own everywhere.
// Pre-renders a procedural city (river, highways, street grids, parks) once, then animates gold deal pins.
(function () {
  var hero = document.querySelector('.hero');
  var canvas = document.querySelector('.hero-map');
  if (!hero || !canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var W = 2600, H = 1700; // world size
  var seed = 7;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

  // ---------- Build the world once ----------
  var world = document.createElement('canvas');
  var dprW = Math.min(window.devicePixelRatio || 1, 1.5);
  world.width = W * dprW; world.height = H * dprW;
  var w = world.getContext('2d');
  w.scale(dprW, dprW);
  w.fillStyle = '#070B0A'; w.fillRect(0, 0, W, H);

  // River
  var river = [];
  for (var x = -100; x <= W + 100; x += 60) river.push([x, 900 + Math.sin(x / 260) * 160 + Math.sin(x / 90) * 28 - x * 0.18]);
  function path(pts) { w.beginPath(); w.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length - 1; i++) { var mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; w.quadraticCurveTo(pts[i][0], pts[i][1], mx, my); } }
  path(river); w.strokeStyle = 'rgba(47,98,80,.55)'; w.lineWidth = 34; w.lineCap = 'round'; w.stroke();
  path(river); w.strokeStyle = 'rgba(70,140,115,.25)'; w.lineWidth = 12; w.stroke();

  // Parks
  for (var p = 0; p < 16; p++) {
    var px = rnd() * W, py = rnd() * H, pr = 40 + rnd() * 110;
    var g = w.createRadialGradient(px, py, 0, px, py, pr);
    g.addColorStop(0, 'rgba(47,98,80,.28)'); g.addColorStop(1, 'rgba(47,98,80,0)');
    w.fillStyle = g; w.beginPath(); w.arc(px, py, pr, 0, Math.PI * 2); w.fill();
  }

  // Street grids in districts, each slightly rotated
  for (var d = 0; d < 26; d++) {
    var cx = rnd() * W, cy = rnd() * H, size = 220 + rnd() * 260, ang = (rnd() - 0.5) * 0.9, step = 22 + rnd() * 16;
    w.save(); w.translate(cx, cy); w.rotate(ang);
    w.strokeStyle = 'rgba(255,255,255,' + (0.055 + rnd() * 0.05) + ')'; w.lineWidth = 1;
    for (var s = -size; s <= size; s += step) {
      w.beginPath(); w.moveTo(-size, s); w.lineTo(size, s); w.stroke();
      w.beginPath(); w.moveTo(s, -size); w.lineTo(s, size); w.stroke();
    }
    w.restore();
  }

  // Highways
  function highway(a, b, c, e) {
    w.beginPath(); w.moveTo(a[0], a[1]); w.bezierCurveTo(b[0], b[1], c[0], c[1], e[0], e[1]);
    w.strokeStyle = 'rgba(214,189,134,.10)'; w.lineWidth = 7; w.stroke();
    w.strokeStyle = 'rgba(214,189,134,.5)'; w.lineWidth = 1.8; w.stroke();
  }
  highway([-50, 300], [700, 380], [1500, 120], [W + 50, 260]);
  highway([300, -50], [500, 600], [900, 1100], [700, H + 50]);
  highway([-50, 1400], [900, 1150], [1700, 1500], [W + 50, 1250]);
  highway([1800, -50], [1600, 500], [2100, 1000], [1900, H + 50]);
  // Perimeter loop
  w.beginPath(); w.ellipse(W / 2, H / 2, 900, 560, -0.12, 0, Math.PI * 2);
  w.strokeStyle = 'rgba(214,189,134,.08)'; w.lineWidth = 8; w.stroke();
  w.strokeStyle = 'rgba(214,189,134,.26)'; w.lineWidth = 1.4; w.stroke();

  // ---------- Deal pins ----------
  var LABELS = ['Due diligence · today', 'Closing in 12 days', 'Showing · 1:00 PM', 'Appraisal ordered', 'Contract read · 7 dates', 'New lead · call back', 'Financing · 5 days', 'Listing goes live Fri', 'Final walkthrough'];
  var pins = [];
  for (var k = 0; k < 34; k++) pins.push({ x: 120 + rnd() * (W - 240), y: 120 + rnd() * (H - 240), ph: rnd() * Math.PI * 2, label: k < LABELS.length ? LABELS[k] : null, big: k < LABELS.length });

  // ---------- View ----------
  var vw = 0, vh = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
  var cam = { x: W / 2, y: H / 2 }, goal = { x: W / 2, y: H / 2 }, vel = { x: 0.18, y: 0.07 }, mouse = { x: 0, y: 0 }, par = { x: 0, y: 0 }, samples = [];
  function resize() {
    vw = canvas.offsetWidth; vh = canvas.offsetHeight;
    canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
  }
  resize(); addEventListener('resize', resize);

  // No dragging: the camera cruises the city on its own along a slow, looping path. The mouse only adds a little parallax.
  addEventListener('pointermove', function (e) { if (e.pointerType === 'touch') return; mouse.x = e.clientX / innerWidth - 0.5; mouse.y = e.clientY / innerHeight - 0.5; });

  var visible = true;
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) requestAnimationFrame(frame); }).observe(hero);

  function frame(t) {
    if (!visible) return;
    var mx = vw / 2 + 60, my = vh / 2 + 60, tt = (t || 0) / 1000;
    if (!still) {
      var ax = Math.max(0, W / 2 - mx), ay = Math.max(0, H / 2 - my);
      goal.x = W / 2 + ax * Math.sin(tt * 0.07 + 0.6) * 0.92;
      goal.y = H / 2 + ay * Math.sin(tt * 0.05 + 2.1) * 0.92;
    }
    goal.x = Math.min(W - mx, Math.max(mx, goal.x)); goal.y = Math.min(H - my, Math.max(my, goal.y));
    cam.x += (goal.x - cam.x) * 0.06; cam.y += (goal.y - cam.y) * 0.06;
    par.x += (mouse.x * 40 - par.x) * 0.05; par.y += (mouse.y * 26 - par.y) * 0.05;
    canvas.style.setProperty('--tilt', (mouse.x * 4).toFixed(2) + 'deg');

    var ox = cam.x - vw / 2 + par.x, oy = cam.y - vh / 2 + par.y;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vw, vh);
    ctx.drawImage(world, ox * dprW, oy * dprW, vw * dprW, vh * dprW, 0, 0, vw, vh);

    var time = (t || 0) / 1000;
    ctx.font = '500 12px Inter, -apple-system, Helvetica, Arial, sans-serif';
    for (var i = 0; i < pins.length; i++) {
      var pin = pins[i], sx = pin.x - ox, sy = pin.y - oy;
      if (sx < -160 || sy < -40 || sx > vw + 40 || sy > vh + 40) continue;
      var pulse = still ? 0.5 : (Math.sin(time * 1.6 + pin.ph) + 1) / 2;
      var r = pin.big ? 4.2 : 2.6;
      ctx.beginPath(); ctx.arc(sx, sy, r + 10 + pulse * 10, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(214,189,134,' + (0.10 * (1 - pulse)) + ')'; ctx.fill();
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fillStyle = pin.big ? '#E8D3A2' : 'rgba(214,189,134,.7)'; ctx.fill();
      if (pin.label && vw >= 700) {
        var tw = ctx.measureText(pin.label).width + 18, bx = sx + 12, by = sy - 26;
        ctx.fillStyle = 'rgba(13,19,17,.78)'; ctx.strokeStyle = 'rgba(214,189,134,.28)'; ctx.lineWidth = 1;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(bx, by, tw, 24, 12); else ctx.rect(bx, by, tw, 24);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.86)'; ctx.fillText(pin.label, bx + 9, by + 16);
      }
    }
    if (!still) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
