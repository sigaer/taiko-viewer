export default defineNuxtPlugin(() => {
  if (window.__clickLoveInitialized) return;
  window.__clickLoveInitialized = true;

  const hearts = [];

  const createHeart = (x, y) => {
    const el = document.createElement("div");
    el.className = "click-heart";
    el.style.left = `${x - 6}px`;
    el.style.top = `${y - 6}px`;
    document.body.appendChild(el);
    hearts.push({
      el,
      x,
      y,
      scale: 1,
      alpha: 1,
      color: `hsl(${Math.random() * 40 + 10}, 80%, 70%)`
    });
  };

  const animate = () => {
    for (let i = 0; i < hearts.length; i += 1) {
      const heart = hearts[i];
      heart.y -= 1.2;
      heart.scale += 0.004;
      heart.alpha -= 0.012;
      heart.el.style.transform = `translate(-50%, -50%) scale(${heart.scale}) rotate(45deg)`;
      heart.el.style.opacity = heart.alpha;
      heart.el.style.background = heart.color;
      if (heart.alpha <= 0) {
        heart.el.remove();
        hearts.splice(i, 1);
        i -= 1;
      }
    }
    requestAnimationFrame(animate);
  };

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(".story-player, .annual-page")) return;
    createHeart(event.clientX, event.clientY);
  });

  const style = document.createElement("style");
  style.innerHTML = `
    .click-heart {
      position: fixed;
      width: 12px;
      height: 12px;
      transform: translate(-50%, -50%) rotate(45deg);
      pointer-events: none;
      border-radius: 3px;
      z-index: 2;
    }
    .click-heart::before,
    .click-heart::after {
      content: "";
      position: absolute;
      width: 12px;
      height: 12px;
      background: inherit;
      border-radius: 50%;
      top: -6px;
      left: 0;
    }
    .click-heart::after {
      top: 0;
      left: -6px;
    }
  `;
  document.head.appendChild(style);

  requestAnimationFrame(animate);
});
