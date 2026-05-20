export default defineNuxtPlugin(() => {
  if (window.__dynamicLineInitialized) return;
  window.__dynamicLineInitialized = true;

  const canvas = document.createElement("canvas");
  canvas.id = "dynamic-line";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  const points = [];
  const pointCount = 60;
  const maxDist = 120;

  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };

  const init = () => {
    points.length = 0;
    for (let i = 0; i < pointCount; i += 1) {
      points.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.7,
        vy: (Math.random() - 0.5) * 0.7
      });
    }
  };

  const draw = () => {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    points.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x <= 0 || p.x >= canvas.width) p.vx *= -1;
      if (p.y <= 0 || p.y >= canvas.height) p.vy *= -1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.4, 0, Math.PI * 2);
      ctx.fill();
    });
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const dx = points[i].x - points[j].x;
        const dy = points[i].y - points[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < maxDist) {
          const alpha = 1 - dist / maxDist;
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.3})`;
          ctx.beginPath();
          ctx.moveTo(points[i].x, points[i].y);
          ctx.lineTo(points[j].x, points[j].y);
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  };

  resize();
  init();
  draw();
  window.addEventListener("resize", () => {
    resize();
    init();
  });
});
