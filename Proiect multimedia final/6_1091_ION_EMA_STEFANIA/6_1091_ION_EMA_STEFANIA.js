

const svg = document.getElementById("drawingArea");
const toolButtons = document.querySelectorAll("#toolbar button[data-tool]");
const strokeColorInput = document.getElementById("strokeColor");
const fillColorInput = document.getElementById("fillColor");
const strokeWidthInput = document.getElementById("strokeWidth");
const undoBtn = document.getElementById("undoBtn");
const deleteBtn = document.getElementById("deleteBtn");
const clearAllBtn = document.getElementById("clearAllBtn");
const exportPngBtn = document.getElementById("exportPngBtn");
const saveSvgBtn = document.getElementById("saveSvgBtn");


let currentTool = "select";
let currentStroke = strokeColorInput.value;
let currentFill = fillColorInput.value;
let currentStrokeWidth = parseInt(strokeWidthInput.value, 10);

let isDrawing = false;
let currentElement = null;
let selectedElement = null;
let undoStack = [];
let dragInfo = null;          
let isDrawingPath = false;   
let currentPathPoints = [];   



// Cerinta: Salvarea automata si Undo (folosim aceeasi functie de salvare)

function removePathPoints() {
  const points = svg.querySelectorAll(".path-point");
  points.forEach(p => p.remove());
}

function saveStateForUndo() {
  
  removePathPoints();
  undoStack.push(svg.innerHTML);
  if (undoStack.length > 50) {
    undoStack.shift();
  }
  // Cerinta: salvarea automata cu Web Storage API
  localStorage.setItem("svgDrawing", svg.innerHTML);
}

function loadFromStorage() {
  const data = localStorage.getItem("svgDrawing");
  if (data) {
    svg.innerHTML = data;
  }

  undoStack = [];
  undoStack.push(svg.innerHTML);
}

// Functie pentru coordonatele mouse-ului in sistemul SVG
function getMousePosition(evt) {
  const rect = svg.getBoundingClientRect();
  return {
    x: evt.clientX - rect.left,
    y: evt.clientY - rect.top
  };
}


// Cerinta: Selectare element si modificare proprietati

function setSelectedElement(el) {
  // stergem selectia veche
  if (selectedElement) {
    selectedElement.classList.remove("selected-svg-element");
  }
  removePathPoints();
  selectedElement = el;
  if (selectedElement) {
    selectedElement.classList.add("selected-svg-element");
    // daca este path, afisam punctele de control
    if (selectedElement.tagName.toLowerCase() === "path") {
      showPathPoints(selectedElement);
    }
  }
}


// Cerinta: forme de baza + culoare/grosime


// schimbare instrument
toolButtons.forEach((button) => {
  button.addEventListener("click", () => {
    toolButtons.forEach(b => b.classList.remove("active-tool"));
    button.classList.add("active-tool");
    currentTool = button.dataset.tool;
    if (currentTool !== "select") {
      setSelectedElement(null);
    }
  });
});

// actualizare culori si grosime
strokeColorInput.addEventListener("input", () => {
  currentStroke = strokeColorInput.value;
  if (selectedElement) {
    selectedElement.setAttribute("stroke", currentStroke);
    saveStateForUndo();
  }
});

fillColorInput.addEventListener("input", () => {
  currentFill = fillColorInput.value;
  if (selectedElement && selectedElement.tagName.toLowerCase() !== "line") {
    selectedElement.setAttribute("fill", currentFill);
    saveStateForUndo();
  }
});

strokeWidthInput.addEventListener("input", () => {
  currentStrokeWidth = parseInt(strokeWidthInput.value, 10);
  if (selectedElement) {
    selectedElement.setAttribute("stroke-width", currentStrokeWidth);
    saveStateForUndo();
  }
});


// Cerinta: Desenare forme (linie, dreptunghi, elipsa)

let startX = 0;
let startY = 0;

svg.addEventListener("mousedown", (evt) => {
  const pos = getMousePosition(evt);
  const target = evt.target;

  // Mutare punct de control path
  if (currentTool === "select" && target.classList.contains("path-point")) {
    const index = parseInt(target.dataset.index, 10);
    const path = selectedElement;
    if (!path) return;
    const originalPoints = parsePathD(path.getAttribute("d"));
    dragInfo = {
      type: "point",
      circle: target,
      path: path,
      pointIndex: index,
      originalPoints: originalPoints,
      startMouseX: pos.x,
      startMouseY: pos.y
    };
    return;
  }

  // Mutare element selectat
  if (currentTool === "select" && target !== svg && !target.classList.contains("path-point")) {
    setSelectedElement(target);
    const tag = target.tagName.toLowerCase();
    const drag = { type: "element", element: target, startMouseX: pos.x, startMouseY: pos.y };

    if (tag === "rect") {
      drag.x = parseFloat(target.getAttribute("x")) || 0;
      drag.y = parseFloat(target.getAttribute("y")) || 0;
    } else if (tag === "ellipse") {
      drag.cx = parseFloat(target.getAttribute("cx")) || 0;
      drag.cy = parseFloat(target.getAttribute("cy")) || 0;
    } else if (tag === "line") {
      drag.x1 = parseFloat(target.getAttribute("x1")) || 0;
      drag.y1 = parseFloat(target.getAttribute("y1")) || 0;
      drag.x2 = parseFloat(target.getAttribute("x2")) || 0;
      drag.y2 = parseFloat(target.getAttribute("y2")) || 0;
    } else if (tag === "path") {
      drag.points = parsePathD(target.getAttribute("d"));
    }
    dragInfo = drag;
    return;
  }

  // click pe zona goala in modul select => deselectie
  if (currentTool === "select" && target === svg) {
    setSelectedElement(null);
    return;
  }

  // Desenare path (Cale)
  if (currentTool === "path") {
    const x = pos.x;
    const y = pos.y;

    if (!isDrawingPath) {
      
      saveStateForUndo();
      isDrawingPath = true;
      currentPathPoints = [{ x, y }];
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", currentStroke);
      path.setAttribute("stroke-width", currentStrokeWidth);
      path.setAttribute("d", buildPathD(currentPathPoints));
      svg.appendChild(path);
      currentElement = path;
      setSelectedElement(path);
    } else {
      
      currentPathPoints.push({ x, y });
      if (currentElement) {
        currentElement.setAttribute("d", buildPathD(currentPathPoints));
        setSelectedElement(currentElement);
      }
    }
    return;
  }

  // Desenare forme de baza
  if (currentTool === "line" || currentTool === "rect" || currentTool === "ellipse") {
    saveStateForUndo();
    isDrawing = true;
    startX = pos.x;
    startY = pos.y;

    if (currentTool === "line") {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", startX);
      line.setAttribute("y1", startY);
      line.setAttribute("x2", startX);
      line.setAttribute("y2", startY);
      line.setAttribute("stroke", currentStroke);
      line.setAttribute("stroke-width", currentStrokeWidth);
      svg.appendChild(line);
      currentElement = line;
    } else if (currentTool === "rect") {
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", startX);
      rect.setAttribute("y", startY);
      rect.setAttribute("width", 0);
      rect.setAttribute("height", 0);
      rect.setAttribute("stroke", currentStroke);
      rect.setAttribute("stroke-width", currentStrokeWidth);
      rect.setAttribute("fill", currentFill);
      svg.appendChild(rect);
      currentElement = rect;
    } else if (currentTool === "ellipse") {
      const ell = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
      ell.setAttribute("cx", startX);
      ell.setAttribute("cy", startY);
      ell.setAttribute("rx", 0);
      ell.setAttribute("ry", 0);
      ell.setAttribute("stroke", currentStroke);
      ell.setAttribute("stroke-width", currentStrokeWidth);
      ell.setAttribute("fill", currentFill);
      svg.appendChild(ell);
      currentElement = ell;
    }
  }
});

svg.addEventListener("mousemove", (evt) => {
  const pos = getMousePosition(evt);

  // Mutare element
  if (dragInfo && dragInfo.type === "element") {
    const dx = pos.x - dragInfo.startMouseX;
    const dy = pos.y - dragInfo.startMouseY;
    const el = dragInfo.element;
    const tag = el.tagName.toLowerCase();

    if (tag === "rect") {
      el.setAttribute("x", dragInfo.x + dx);
      el.setAttribute("y", dragInfo.y + dy);
    } else if (tag === "ellipse") {
      el.setAttribute("cx", dragInfo.cx + dx);
      el.setAttribute("cy", dragInfo.cy + dy);
    } else if (tag === "line") {
      el.setAttribute("x1", dragInfo.x1 + dx);
      el.setAttribute("y1", dragInfo.y1 + dy);
      el.setAttribute("x2", dragInfo.x2 + dx);
      el.setAttribute("y2", dragInfo.y2 + dy);
    } else if (tag === "path") {
      const movedPoints = dragInfo.points.map(p => ({
        x: p.x + dx,
        y: p.y + dy
      }));
      el.setAttribute("d", buildPathD(movedPoints));
      // mutam si punctele de control daca exista
      const circles = svg.querySelectorAll(".path-point");
      circles.forEach((c, index) => {
        if (movedPoints[index]) {
          c.setAttribute("cx", movedPoints[index].x);
          c.setAttribute("cy", movedPoints[index].y);
        }
      });
    }
    return;
  }

  // Mutare punct de control pentru path
  if (dragInfo && dragInfo.type === "point") {
    const dx = pos.x - dragInfo.startMouseX;
    const dy = pos.y - dragInfo.startMouseY;
    const pts = dragInfo.originalPoints.map(p => ({ x: p.x, y: p.y }));
    const idx = dragInfo.pointIndex;
    pts[idx].x += dx;
    pts[idx].y += dy;

    dragInfo.path.setAttribute("d", buildPathD(pts));
    dragInfo.circle.setAttribute("cx", pts[idx].x);
    dragInfo.circle.setAttribute("cy", pts[idx].y);
    return;
  }

  // Redimensionare forma in timpul desenarii
  if (!isDrawing || !currentElement) return;

  if (currentTool === "line") {
    currentElement.setAttribute("x2", pos.x);
    currentElement.setAttribute("y2", pos.y);
  } else if (currentTool === "rect") {
    const width = pos.x - startX;
    const height = pos.y - startY;
    currentElement.setAttribute("x", Math.min(startX, pos.x));
    currentElement.setAttribute("y", Math.min(startY, pos.y));
    currentElement.setAttribute("width", Math.abs(width));
    currentElement.setAttribute("height", Math.abs(height));
  } else if (currentTool === "ellipse") {
    const rx = Math.abs(pos.x - startX) / 2;
    const ry = Math.abs(pos.y - startY) / 2;
    const cx = (pos.x + startX) / 2;
    const cy = (pos.y + startY) / 2;
    currentElement.setAttribute("cx", cx);
    currentElement.setAttribute("cy", cy);
    currentElement.setAttribute("rx", rx);
    currentElement.setAttribute("ry", ry);
  }
});

svg.addEventListener("mouseup", () => {
  if (isDrawing) {
    isDrawing = false;
    currentElement = null;
  }
  if (dragInfo) {
    saveStateForUndo();
    dragInfo = null;
  }
});

// Dublu-click pentru a termina desenarea caii
svg.addEventListener("dblclick", () => {
  if (isDrawingPath) {
    isDrawingPath = false;
    currentPathPoints = [];
    currentElement = null;
    saveStateForUndo();
  }
});

// Cerinta: functii pentru path - construire si editare puncte


function buildPathD(points) {
  if (!points.length) return "";
  let d = "M " + points[0].x + " " + points[0].y;
  for (let i = 1; i < points.length; i++) {
    d += " L " + points[i].x + " " + points[i].y;
  }
  return d;
}

function parsePathD(d) {
  const tokens = d.trim().split(/[ ,]+/);
  const points = [];
  let i = 0;
  while (i < tokens.length) {
    const cmd = tokens[i];
    if (cmd === "M" || cmd === "L") {
      const x = parseFloat(tokens[i + 1]);
      const y = parseFloat(tokens[i + 2]);
      points.push({ x, y });
      i += 3;
    } else {
      i++;
    }
  }
  return points;
}

function showPathPoints(pathEl) {
  removePathPoints();
  const d = pathEl.getAttribute("d") || "";
  const points = parsePathD(d);
  points.forEach((p, index) => {
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("cx", p.x);
    c.setAttribute("cy", p.y);
    c.setAttribute("r", 4);
    c.setAttribute("fill", "#ff0000");
    c.classList.add("path-point");
    c.dataset.index = index.toString();
    svg.appendChild(c);
  });
}


// Cerinta: Undo


undoBtn.addEventListener("click", () => {
  if (undoStack.length <= 1) return;
  // scoatem starea curenta
  undoStack.pop();
  const lastState = undoStack[undoStack.length - 1];
  svg.innerHTML = lastState;
  setSelectedElement(null);
  // actualizam si in localStorage
  localStorage.setItem("svgDrawing", svg.innerHTML);
});


// Cerinta: Stergere element selectat


deleteBtn.addEventListener("click", () => {
  if (!selectedElement) return;
  saveStateForUndo();
  if (selectedElement.tagName.toLowerCase() === "path") {
    removePathPoints();
  }
  selectedElement.remove();
  setSelectedElement(null);
});


// Stergere TOT desenul (optional, in plus fata de cerinta)


clearAllBtn.addEventListener("click", () => {
  if (!svg.innerHTML.trim()) return;

  const confirmare = confirm("Ești sigur că vrei să ștergi tot desenul?");
  if (!confirmare) return;

  saveStateForUndo();
  svg.innerHTML = "";
  setSelectedElement(null);
  localStorage.setItem("svgDrawing", svg.innerHTML);
});


// Cerinta: Export desen in format PNG (raster)


exportPngBtn.addEventListener("click", () => {
  removePathPoints();
  const clone = svg.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const svgData = new XMLSerializer().serializeToString(clone);

  const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  img.onload = function () {
    const canvas = document.createElement("canvas");
    canvas.width = svg.clientWidth;
    canvas.height = svg.clientHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);

    const pngData = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = pngData;
    a.download = "desen.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  img.src = url;
});


// Cerinta: Salvare desen in format SVG


saveSvgBtn.addEventListener("click", () => {
  removePathPoints();
  const clone = svg.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const svgData = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "desen.svg";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

// Initializare: incarcare din localStorage (Cerinta Web Storage API)


window.addEventListener("load", () => {
  loadFromStorage();
});
