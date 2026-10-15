import test from "node:test";
import assert from "node:assert/strict";

/**
 * Model of calculateTooltipStyle logic from components/tour/guided-tour-spotlight.tsx
 */
function calculateTooltipStyle({
  isCenteredFallback,
  targetRect,
  currentStep,
  windowWidth,
  windowHeight,
  measuredHeight = 220,
}) {
  const cardWidth = Math.min(380, windowWidth - 32);
  const cardHeight = measuredHeight;
  const gap = 12;
  const edgeMargin = 16;

  if (isCenteredFallback || !targetRect) {
    return {
      top: Math.round((windowHeight - cardHeight) / 2),
      left: Math.round((windowWidth - cardWidth) / 2),
      width: cardWidth,
      isCentered: true,
    };
  }

  const targetBottom = targetRect.top + targetRect.height;
  const targetCenterX = targetRect.left + targetRect.width / 2;

  const spaceBelow = windowHeight - targetBottom - gap - edgeMargin;
  const spaceAbove = targetRect.top - gap - edgeMargin;

  let top;
  const preferred = currentStep?.preferredPlacement || "bottom";

  if (preferred === "top") {
    if (spaceAbove >= cardHeight) {
      top = targetRect.top - gap - cardHeight;
    } else if (spaceBelow >= cardHeight) {
      top = targetBottom + gap;
    } else {
      top = spaceBelow >= spaceAbove ? targetBottom + gap : targetRect.top - gap - cardHeight;
    }
  } else {
    if (spaceBelow >= cardHeight) {
      top = targetBottom + gap;
    } else if (spaceAbove >= cardHeight) {
      top = targetRect.top - gap - cardHeight;
    } else {
      top = Math.max(edgeMargin, (windowHeight - cardHeight) / 2);
    }
  }

  top = Math.min(
    Math.max(edgeMargin, top),
    Math.max(edgeMargin, windowHeight - cardHeight - edgeMargin)
  );

  let left;
  if (targetCenterX > windowWidth * 0.6) {
    left = targetRect.left + targetRect.width - cardWidth;
  } else if (targetCenterX < windowWidth * 0.4) {
    left = targetRect.left;
  } else {
    left = targetCenterX - cardWidth / 2;
  }

  const minLeft = edgeMargin;
  const maxLeft = Math.max(minLeft, windowWidth - cardWidth - edgeMargin);
  left = Math.min(Math.max(minLeft, left), maxLeft);

  return {
    top: Math.round(top),
    left: Math.round(left),
    width: cardWidth,
    height: cardHeight,
    isCentered: false,
  };
}

const VIEWPORTS = [
  { name: "Mobile Small (360x740)", width: 360, height: 740 },
  { name: "Mobile iPhone SE (375x667)", width: 375, height: 667 },
  { name: "Mobile iPhone 14 (390x844)", width: 390, height: 844 },
  { name: "Tablet iPad (768x1024)", width: 768, height: 1024 },
  { name: "Laptop (1366x768)", width: 1366, height: 768 },
  { name: "Desktop FHD 100% Zoom (1920x1080)", width: 1920, height: 1080 },
];

const BUYER_STEPS = [
  { id: "buyer-welcome", preferredPlacement: "bottom" },
  { id: "buyer-search", preferredPlacement: "bottom" },
  { id: "buyer-products", preferredPlacement: "top" },
  { id: "buyer-cart", preferredPlacement: "bottom" },
  { id: "buyer-messages", preferredPlacement: "bottom" },
  { id: "buyer-orders", preferredPlacement: "bottom" },
];

test("Guided Tour Viewport-Aware Tooltip Positioning", async (t) => {
  for (const vp of VIEWPORTS) {
    await t.test(`All steps stay within viewport at ${vp.name}`, () => {
      // Test different target coordinates (left-edge, center, right-edge, bottom-nav)
      const mockTargets = [
        // Brand logo (left aligned in header)
        { top: 12, left: 16, width: 140, height: 36 },
        // Search bar (center/fluid)
        { top: 12, left: vp.width / 2 - 150, width: 300, height: 40 },
        // Product catalog (large section)
        { top: 180, left: 16, width: vp.width - 32, height: 400 },
        // Cart button (right aligned in header)
        { top: 12, left: vp.width - 120, width: 40, height: 40 },
        // Messages button (right aligned in header)
        { top: 12, left: vp.width - 80, width: 40, height: 40 },
        // Account menu / avatar (far right in header)
        { top: 12, left: vp.width - 48, width: 36, height: 36 },
        // Mobile bottom nav item (at bottom edge of mobile screen)
        { top: vp.height - 64, left: vp.width - 70, width: 50, height: 48 },
      ];

      for (const step of BUYER_STEPS) {
        for (const targetRect of mockTargets) {
          const style = calculateTooltipStyle({
            isCenteredFallback: false,
            targetRect,
            currentStep: step,
            windowWidth: vp.width,
            windowHeight: vp.height,
            measuredHeight: 220,
          });

          // 1. Must never overflow right edge (at least 16px padding)
          assert.ok(
            style.left + style.width <= vp.width - 16,
            `Right overflow on ${step.id} at ${vp.name}: left(${style.left}) + width(${style.width}) = ${style.left + style.width} > max(${vp.width - 16})`
          );

          // 2. Must never overflow left edge (at least 16px padding)
          assert.ok(
            style.left >= 16,
            `Left overflow on ${step.id} at ${vp.name}: left(${style.left}) < min(16)`
          );

          // 3. Must never overflow bottom edge
          assert.ok(
            style.top + style.height <= vp.height - 16,
            `Bottom overflow on ${step.id} at ${vp.name}: top(${style.top}) + height(${style.height}) = ${style.top + style.height} > max(${vp.height - 16})`
          );

          // 4. Must never overflow top edge
          assert.ok(
            style.top >= 16,
            `Top overflow on ${step.id} at ${vp.name}: top(${style.top}) < min(16)`
          );
        }
      }
    });

    await t.test(`Fallback centering on hidden target at ${vp.name}`, () => {
      const style = calculateTooltipStyle({
        isCenteredFallback: true,
        targetRect: null,
        currentStep: { id: "buyer-messages", preferredPlacement: "bottom" },
        windowWidth: vp.width,
        windowHeight: vp.height,
        measuredHeight: 220,
      });

      assert.strictEqual(style.isCentered, true);
      assert.ok(style.left >= 16);
      assert.ok(style.left + style.width <= vp.width - 16);
    });
  }
});
