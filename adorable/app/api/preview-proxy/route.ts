import { NextRequest, NextResponse } from "next/server";

/**
 * Preview Proxy — Fetches HTML from the VM dev server, injects the
 * browser bridge client script, and serves it same-origin so the
 * parent frame can communicate via postMessage.
 *
 * Usage: /api/preview-proxy?target=http://localhost:4100&path=/about
 */

// ─── Bridge Client Script (injected into every proxied HTML page) ───

const BRIDGE_CLIENT_SCRIPT = `
<script data-adorable-bridge>
(function() {
  if (window.__adorableBridge) return;
  window.__adorableBridge = true;

  // Notify parent that the bridge is ready
  window.parent.postMessage({ type: "bridge:ready" }, "*");

  // Visual feedback helpers
  function showClickIndicator(x, y) {
    var dot = document.createElement("div");
    dot.style.cssText =
      "position:fixed;z-index:999999;pointer-events:none;" +
      "width:20px;height:20px;border-radius:50%;background:rgba(239,68,68,0.7);" +
      "border:2px solid #ef4444;transform:translate(-50%,-50%);" +
      "left:" + x + "px;top:" + y + "px;transition:opacity 0.5s,transform 0.5s;";
    document.body.appendChild(dot);
    setTimeout(function() { dot.style.opacity = "0"; dot.style.transform = "translate(-50%,-50%) scale(2)"; }, 100);
    setTimeout(function() { dot.remove(); }, 600);
  }

  function highlightElement(el) {
    if (!el || !el.style) return;
    var prev = el.style.outline;
    el.style.outline = "2px solid #3b82f6";
    setTimeout(function() { el.style.outline = prev; }, 1000);
  }

  // Command handlers
  var handlers = {
    navigate: function(cmd) {
      window.location.href = cmd.url || "/";
      return { success: true, data: "Navigating to " + (cmd.url || "/") };
    },

    click: function(cmd) {
      var el;
      if (cmd.selector) {
        el = document.querySelector(cmd.selector);
        if (!el) return { success: false, error: "Element not found: " + cmd.selector };
      } else {
        return { success: false, error: "Selector required for click" };
      }
      var rect = el.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      showClickIndicator(cx, cy);
      highlightElement(el);
      el.click();
      return { success: true, data: "Clicked " + cmd.selector };
    },

    type: function(cmd) {
      if (!cmd.selector) return { success: false, error: "Selector required for type" };
      if (!cmd.text) return { success: false, error: "Text required for type" };
      var el = document.querySelector(cmd.selector);
      if (!el) return { success: false, error: "Element not found: " + cmd.selector };
      highlightElement(el);
      el.focus();
      // Set value for input/textarea
      if ("value" in el) {
        var nativeSetter = Object.getOwnPropertyDescriptor(
          el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value"
        );
        if (nativeSetter && nativeSetter.set) nativeSetter.set.call(el, cmd.text);
        else el.value = cmd.text;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        el.textContent = cmd.text;
      }
      return { success: true, data: "Typed into " + cmd.selector };
    },

    scroll_up: function() {
      window.scrollBy({ top: -400, behavior: "smooth" });
      return { success: true, data: "Scrolled up" };
    },

    scroll_down: function() {
      window.scrollBy({ top: 400, behavior: "smooth" });
      return { success: true, data: "Scrolled down" };
    },

    wait: function() {
      return new Promise(function(resolve) {
        setTimeout(function() { resolve({ success: true, data: "Waited 2s" }); }, 2000);
      });
    },

    evaluate: function(cmd) {
      if (!cmd.script) return { success: false, error: "Script required for evaluate" };
      try {
        var result = new Function(cmd.script)();
        return { success: true, data: result !== undefined ? String(result) : "undefined" };
      } catch (e) {
        return { success: false, error: "Eval error: " + (e instanceof Error ? e.message : String(e)) };
      }
    },

    screenshot: function() {
      return new Promise(function(resolve) {
        // Use html2canvas if available, otherwise basic fallback
        function captureWithHtml2Canvas() {
          html2canvas(document.body, {
            useCORS: true,
            scale: 1,
            width: Math.min(window.innerWidth, 1280),
            height: Math.min(window.innerHeight, 720),
            windowWidth: Math.min(window.innerWidth, 1280),
            windowHeight: Math.min(window.innerHeight, 720),
          }).then(function(canvas) {
            resolve({ success: true, screenshot: canvas.toDataURL("image/png", 0.8) });
          }).catch(function(err) {
            resolve({ success: false, error: "Screenshot failed: " + err.message });
          });
        }

        if (typeof html2canvas !== "undefined") {
          captureWithHtml2Canvas();
        } else {
          var s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
          s.onload = captureWithHtml2Canvas;
          s.onerror = function() {
            resolve({ success: false, error: "Failed to load html2canvas" });
          };
          document.head.appendChild(s);
        }
      });
    },

    get_snapshot: function() {
      function walkDom(node, depth) {
        if (depth > 4 || !node) return "";
        var out = "";
        var children = node.children || [];
        for (var i = 0; i < Math.min(children.length, 50); i++) {
          var el = children[i];
          var tag = el.tagName.toLowerCase();
          if (tag === "script" || tag === "style" || tag === "noscript") continue;
          var id = el.id ? "#" + el.id : "";
          var cls = el.className && typeof el.className === "string" ?
            "." + el.className.trim().split(/\\s+/).slice(0, 3).join(".") : "";
          var text = el.textContent ? el.textContent.trim().slice(0, 40) : "";
          var indent = "  ".repeat(depth);
          out += indent + "<" + tag + id + cls + ">" + (text && !el.children.length ? " " + text : "") + "\\n";
          out += walkDom(el, depth + 1);
        }
        return out;
      }
      var snapshot = walkDom(document.body, 0);
      return { success: true, data: snapshot.slice(0, 5000) };
    }
  };

  // Listen for commands from parent
  window.addEventListener("message", function(event) {
    if (!event.data || event.data.type !== "bridge:command") return;
    var cmd = event.data;
    var handler = handlers[cmd.action];
    if (!handler) {
      window.parent.postMessage({
        type: "bridge:result", id: cmd.id,
        success: false, error: "Unknown action: " + cmd.action
      }, "*");
      return;
    }

    // Execute — handler can return sync or Promise
    try {
      var result = handler(cmd);
      if (result && typeof result.then === "function") {
        result.then(function(r) {
          window.parent.postMessage(Object.assign({ type: "bridge:result", id: cmd.id }, r), "*");
        });
      } else {
        window.parent.postMessage(Object.assign({ type: "bridge:result", id: cmd.id }, result), "*");
      }
    } catch (e) {
      window.parent.postMessage({
        type: "bridge:result", id: cmd.id,
        success: false, error: "Bridge error: " + (e instanceof Error ? e.message : String(e))
      }, "*");
    }
  });
})();
</script>`;

// ─── Proxy Handler ───

export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("target");
  const path = req.nextUrl.searchParams.get("path") || "/";

  if (!target) {
    return new NextResponse("Missing ?target= parameter", { status: 400 });
  }

  // Build the full URL to fetch from the VM
  const vmUrl = target.endsWith("/")
    ? `${target.slice(0, -1)}${path}`
    : `${target}${path}`;

  try {
    const vmResponse = await fetch(vmUrl, {
      headers: {
        Accept: "text/html, */*",
        "User-Agent": "Adorable-Preview-Proxy/1.0",
      },
      redirect: "follow",
    });

    const contentType = vmResponse.headers.get("content-type") ?? "";

    // Only inject into HTML responses
    if (!contentType.includes("text/html")) {
      // Pass through non-HTML (CSS, JS, images, fonts, JSON, etc.)
      return new NextResponse(vmResponse.body, {
        status: vmResponse.status,
        headers: {
          "content-type": contentType,
          "cache-control": vmResponse.headers.get("cache-control") ?? "no-cache",
        },
      });
    }

    let html = await vmResponse.text();

    // Inject <base> tag so relative URLs (CSS, JS, images) still load from the VM
    const baseTag = `<base href="${target}/">`;
    if (html.includes("<head>")) {
      html = html.replace("<head>", `<head>${baseTag}`);
    } else if (html.includes("<HEAD>")) {
      html = html.replace("<HEAD>", `<HEAD>${baseTag}`);
    } else {
      html = baseTag + html;
    }

    // Inject the bridge script before </body> (or append at end)
    if (html.includes("</body>")) {
      html = html.replace("</body>", `${BRIDGE_CLIENT_SCRIPT}</body>`);
    } else if (html.includes("</BODY>")) {
      html = html.replace("</BODY>", `${BRIDGE_CLIENT_SCRIPT}</BODY>`);
    } else {
      html += BRIDGE_CLIENT_SCRIPT;
    }

    return new NextResponse(html, {
      status: vmResponse.status,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new NextResponse(
      `<html><body style="font-family:system-ui;padding:2rem;color:#ef4444">
        <h2>Preview Unavailable</h2>
        <p>Could not reach the dev server at <code>${vmUrl}</code></p>
        <p style="color:#666">${msg}</p>
      </body></html>`,
      { status: 502, headers: { "content-type": "text/html" } },
    );
  }
}
