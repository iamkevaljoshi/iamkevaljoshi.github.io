/* Home hero: the name drawn in particles that scatter from the cursor and spring back. */
(function () {
  var $ = function (s) { return document.querySelector(s); };
  var canvas = $('#name-canvas'), stage = $('#stage');
  if (!canvas) return;
  var ctx = canvas.getContext('2d'), root = document.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NAME = canvas.dataset.name || 'Keval Joshi';
  var particles = [], dpr = 1, W = 0, H = 0, fontSize = 100, running = false, visible = true;
  var pointer = { x: -9999, y: -9999, active: false };
  var ink = '#17203A', gold = '#C98100';

  function readColors() {
    var cs = getComputedStyle(root);
    ink = cs.getPropertyValue('--ink').trim();
    gold = cs.getPropertyValue('--gold').trim();
    if (reduce) draw();
  }

  function build() {
    W = stage.clientWidth;
    var words = NAME.split(/\s+/);
    var lines = W < 640 ? words : [words.join(' ')];
    var off = document.createElement('canvas'), o = off.getContext('2d');
    var font = function (s) { return '800 ' + s + 'px ' + getComputedStyle(document.body).fontFamily; };
    o.font = font(200);
    var widest = Math.max.apply(null, lines.map(function (l) { return o.measureText(l).width; }));
    fontSize = Math.min(200 * (W * 0.99) / widest, 280);
    var lh = fontSize * 0.9;
    H = Math.ceil(lh * (lines.length - 1) + fontSize * 0.98);
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.height = H + 'px';
    off.width = W; off.height = H;
    o.font = font(fontSize); o.fillStyle = '#000'; o.textBaseline = 'alphabetic';
    lines.forEach(function (l, i) { o.fillText(l, 0, fontSize * 0.78 + i * lh); });
    var data = o.getImageData(0, 0, W, H).data;
    var gap = Math.max(3, Math.round(fontSize / 34));
    var old = particles;
    particles = [];
    for (var y = 0; y < H; y += gap) for (var x = 0; x < W; x += gap) {
      if (data[(y * W + x) * 4 + 3] > 140) {
        var prev = old[particles.length];
        particles.push({
          hx: x, hy: y,
          x: prev ? prev.x : (reduce ? x : Math.random() * W),
          y: prev ? prev.y : (reduce ? y : H + Math.random() * H * 0.6),
          vx: 0, vy: 0, r: gap * 0.42, gold: Math.random() < 0.06,
          k: 0.035 + Math.random() * 0.03
        });
      }
    }
    draw();
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    [false, true].forEach(function (pass) {
      ctx.fillStyle = pass ? gold : ink;
      ctx.beginPath();
      particles.forEach(function (p) {
        if (p.gold === pass) { ctx.moveTo(p.x + p.r, p.y); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); }
      });
      ctx.fill();
    });
  }

  function step() {
    var R = fontSize * 0.55, R2 = R * R;
    particles.forEach(function (p) {
      if (pointer.active) {
        var dx = p.x - pointer.x, dy = p.y - pointer.y, d2 = dx * dx + dy * dy;
        if (d2 < R2 && d2 > 0.01) {
          var d = Math.sqrt(d2), f = (1 - d / R) * 7;
          p.vx += dx / d * f; p.vy += dy / d * f;
        }
      }
      p.vx += (p.hx - p.x) * p.k; p.vy += (p.hy - p.y) * p.k;
      p.vx *= 0.82; p.vy *= 0.82;
      p.x += p.vx; p.y += p.vy;
    });
    draw();
    if (visible) requestAnimationFrame(step); else running = false;
  }
  function start() { if (!running && !reduce) { running = true; requestAnimationFrame(step); } }

  function setPointer(e) {
    var r = canvas.getBoundingClientRect();
    pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top; pointer.active = true;
  }
  stage.addEventListener('pointermove', setPointer);
  stage.addEventListener('pointerdown', setPointer);
  stage.addEventListener('pointerleave', function () { pointer.active = false; });
  stage.addEventListener('pointerup', function (e) { if (e.pointerType !== 'mouse') pointer.active = false; });

  new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) start(); }).observe(stage);

  var rt;
  addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (stage.clientWidth !== W) build(); }, 150); });
  document.addEventListener('themechange', readColors);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readColors);

  if (!matchMedia('(hover: hover)').matches) $('#hintText').textContent = 'Drag your finger across my name';
  if (!reduce) $('#hint').classList.add('on');

  var fontReady = document.fonts ? Promise.race([
    document.fonts.load('800 100px "Bricolage Grotesque"'),
    new Promise(function (r) { setTimeout(r, 1500); })
  ]) : Promise.resolve();
  fontReady.then(function () { readColors(); build(); start(); });
})();
