/* ============================================================
   HERO ENGINE — Form 127
   Cinematic 3D hero · scroll system · premium motion
   Device-aware · reduced-motion aware · performance-first
   Preserves existing content & functionality.
   ============================================================ */
import * as THREE from '/assets/vendor/three.module.min.js';

(function () {
  'use strict';

  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const isMobile = coarsePointer && !finePointer;

  let webglOK = false;
  try {
    const t = document.createElement('canvas');
    webglOK = !!(t.getContext('webgl2') || t.getContext('webgl'));
  } catch (_) { webglOK = false; }

  const tier = (!webglOK || reducedMotion) ? 'none' : (isMobile ? 'mobile' : 'full');

  const $ = (s) => document.querySelector(s);
  const heroScene = $('#hero-scene');
  const heroCard = $('#start-card');

  let renderer = null, scene = null, camera = null, sceneGroup = null;
  let clock = null, running = false, rafId = 0;
  let pointerX = 0, pointerY = 0, targetX = 0, targetY = 0;

  /* ---------- 3D scene ---------- */
  function buildScene() {
    const container = heroScene;
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier === 'full' ? 2 : 1.5));
    renderer.setSize(w, h);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
    camera.position.set(0, 0, 9);

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(4, 6, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x38BDF8, 0.5);
    rim.position.set(-5, -2, 3);
    scene.add(rim);

    sceneGroup = new THREE.Group();
    scene.add(sceneGroup);

    const navy = new THREE.MeshStandardMaterial({ color: 0x0F172A, roughness: 0.28, metalness: 0.55, flatShading: true });
    const slate = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.35, metalness: 0.4, flatShading: true });
    const blue = new THREE.MeshStandardMaterial({ color: 0x0369A1, roughness: 0.3, metalness: 0.35, flatShading: true });
    const sky = new THREE.MeshStandardMaterial({ color: 0x38BDF8, roughness: 0.4, metalness: 0.2 });
    const wire = new THREE.MeshStandardMaterial({ color: 0x0369A1, wireframe: true, roughness: 0.6 });

    const geo = {
      knot: new THREE.TorusKnotGeometry(0.5, 0.15, 96, 14),
      ring: new THREE.TorusGeometry(0.9, 0.02, 12, 72),
      ico: new THREE.IcosahedronGeometry(0.42, 0),
      box: new THREE.BoxGeometry(0.5, 0.5, 0.5),
      sphere: new THREE.SphereGeometry(3.4, 26, 26),
    };

    const count = tier === 'mobile' ? 22 : 40;
    const mats = [navy, slate, blue];
    const prims = [geo.ico, geo.box, geo.ring];
    for (let i = 0; i < count; i++) {
      const col = i % 6;
      const x = (col / 6 - 0.5) * 12;
      const y = ((Math.floor(i / 6) / Math.ceil(count / 6)) - 0.5) * 6.4;
      const z = -2 - (i % 5) * 1.7;
      const m = new THREE.Mesh(prims[i % prims.length], mats[i % mats.length]);
      m.position.set(x, y, z);
      m.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      m.scale.setScalar(0.7 + Math.random() * 0.9);
      m.userData = {
        speed: 0.4 + Math.random() * 0.7,
        phase: Math.random() * Math.PI * 2,
        rotX: 0.01 + Math.random() * 0.04,
        rotY: 0.01 + Math.random() * 0.04,
      };
      sceneGroup.add(m);
    }

    const knot = new THREE.Mesh(geo.knot, blue);
    knot.position.set(3.6, -1.3, -3.4);
    knot.rotation.x = 0.6;
    knot.rotation.y = 0.4;
    sceneGroup.add(knot);

    const ring = new THREE.Mesh(geo.ring, sky);
    ring.position.set(-4.3, 1.5, -4.2);
    ring.rotation.x = 1.2;
    ring.rotation.y = 0.3;
    sceneGroup.add(ring);

    const wireSphere = new THREE.Mesh(geo.sphere, wire);
    wireSphere.position.set(0, 0.5, -5.6);
    wireSphere.rotation.set(0.4, 0.2, 0.4);
    sceneGroup.add(wireSphere);

    const pCount = tier === 'mobile' ? 50 : 130;
    const pos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 6 - 2;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pMat = new THREE.PointsMaterial({ color: 0x0EA5E9, size: 0.045, transparent: true, opacity: 0.6, depthWrite: false });
    const particles = new THREE.Points(pGeo, pMat);
    sceneGroup.add(particles);

    clock = new THREE.Clock();
  }

  function animate() {
    if (!running) return;
    rafId = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    sceneGroup.rotation.y = t * 0.05;
    sceneGroup.children.forEach((c) => {
      if (c.isPoints || !c.userData.speed) return;
      const u = c.userData;
      c.position.y += Math.sin(t * u.speed + u.phase) * 0.0006;
      c.rotation.x += u.rotX * 0.02;
      c.rotation.y += u.rotY * 0.02;
    });

    if (tier === 'full') {
      targetX += (pointerX - targetX) * 0.03;
      targetY += (pointerY - targetY) * 0.03;
      camera.position.x = targetX * 0.6;
      camera.position.y = targetY * 0.45;
    }
    camera.lookAt(0, 0, -2);
    renderer.render(scene, camera);
  }

  function startRender() { if (running || !renderer) return; running = true; animate(); }
  function stopRender() { running = false; cancelAnimationFrame(rafId); }

  function onResize() {
    if (!renderer) return;
    const w = heroScene.clientWidth || 1;
    const h = heroScene.clientHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  function observeVisibility() {
    if (typeof IntersectionObserver !== 'undefined') {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) startRender(); else stopRender(); });
      }, { threshold: 0.05 });
      if (heroScene) io.observe(heroScene);
    }
    document.addEventListener('visibilitychange', () => { if (document.hidden) stopRender(); else startRender(); });
    window.addEventListener('resize', onResize, { passive: true });
    startRender();
  }

  /* ---------- Cursor parallax (desktop only) ---------- */
  function bindPointer() {
    if (tier !== 'full') return;
    window.addEventListener('pointermove', (e) => {
      pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      pointerY = -((e.clientY / window.innerHeight) * 2 - 1);
    }, { passive: true });
  }

  /* ---------- Motion (GSAP) ---------- */
  function initMotion() {
    if (!gsap) return;
    if (ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
    const ease = 'power3.out';

    const tl = gsap.timeline({ defaults: { ease, duration: 0.9 } });
    tl.from('#hero-logo', { y: 28, opacity: 0, duration: 1.1 })
      .from('#start-card h1', { y: 22, opacity: 0 }, '-=0.7')
      .from('#start-card .start-sub', { y: 18, opacity: 0 }, '-=0.6')
      .from('#start-card .start-actions .btn', { y: 14, opacity: 0, stagger: 0.1 }, '-=0.55')
      .from('#hero-scroll', { opacity: 0, duration: 0.7 }, '-=0.4');

    if (sceneGroup) {
      gsap.from(sceneGroup.scale, { x: 0.86, y: 0.86, z: 0.86, duration: 1.6, ease });
    }

    if (ScrollTrigger) {
      gsap.to('#view-start .hero-inner', {
        scrollTrigger: { trigger: '#view-start', start: 'top top', end: 'bottom top', scrub: true },
        yPercent: 16, opacity: 0.25, ease: 'none',
      });

      const reveals = document.querySelectorAll('[data-reveal]');
      if (reveals.length) {
        gsap.set(reveals, { opacity: 0, y: 28 });
        ScrollTrigger.batch(reveals, {
          start: 'top 86%',
          once: true,
          onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, stagger: 0.12, duration: 0.8, ease }),
        });
      }
      ScrollTrigger.refresh();
    }
  }

  /* ---------- Card tilt (desktop only) ---------- */
  function initTilt() {
    if (!heroCard || tier !== 'full') return;
    heroCard.classList.add('tilt-card');
    let raf = 0;
    heroCard.addEventListener('pointermove', (e) => {
      const r = heroCard.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        heroCard.style.setProperty('--ty', (py * -7).toFixed(2) + 'deg');
        heroCard.style.setProperty('--tx', (px * 7).toFixed(2) + 'deg');
        heroCard.style.setProperty('--ts', Math.min(Math.abs(px) + Math.abs(py) * 2, 1).toFixed(2));
      });
    });
    heroCard.addEventListener('pointerleave', () => {
      cancelAnimationFrame(raf);
      heroCard.style.setProperty('--ty', '0deg');
      heroCard.style.setProperty('--tx', '0deg');
      heroCard.style.setProperty('--ts', '0');
    });
  }

  /* ---------- Header shrink ---------- */
  function initHeader() {
    const header = document.getElementById('app-header');
    if (!header) return;
    let ticking = false;
    const update = () => {
      header.classList.toggle('scrolled', window.scrollY > 12);
      ticking = false;
    };
    window.addEventListener('scroll', () => { if (!ticking) { requestAnimationFrame(update); ticking = true; } }, { passive: true });
  }

  /* ---------- Scroll cue → start ---------- */
  function initScrollCue() {
    const cue = document.getElementById('hero-scroll');
    const startBtn = document.getElementById('btn-start');
    if (!cue) return;
    cue.addEventListener('click', () => {
      if (startBtn) startBtn.click();
      else window.scrollTo({ top: window.innerHeight, behavior: 'smooth' });
    });
  }

  function init() {
    if (!heroScene) return;
    const yEl = document.getElementById('footer-year');
    if (yEl) yEl.textContent = String(new Date().getFullYear());
    if (tier !== 'none') { buildScene(); bindPointer(); observeVisibility(); }
    initMotion();
    initTilt();
    initHeader();
    initScrollCue();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  document.addEventListener('langchange', () => { if (gsap && ScrollTrigger) ScrollTrigger.refresh(); });
})();