// Liquid Glass stuff (copied from https://github.com/shuding/liquid-glass/blob/main/liquid-glass.js)

/**
 * @param {number} a
 * @param {number} b
 * @param {number} t
 * @returns {number}
 */
export function smoothStep(a, b, t) {
	t = Math.max(0, Math.min(1, (t - a) / (b - a)));
	return t * t * (3 - 2 * t);
}
/**
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
export function length(x, y) {
	return Math.sqrt(x * x + y * y);
}
/**
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @param {number} radius
 * @returns {number}
 */
export function roundedRectSDF(x, y, width, height, radius) {
	const qx = Math.abs(x) - width + radius;
	const qy = Math.abs(y) - height + radius;
	return Math.min(Math.max(qx, qy), 0) + length(Math.max(qx, 0), Math.max(qy, 0)) - radius;
}

/** @param {number} x @param {number} y */
export function texture(x, y) {
	return { type: 't', x, y };
}

function generateId() {
	return `liquid-glass-${Math.random().toString(36).substring(2, 9)}`;
}

export class Shader {
	/** @type {number} */
	width;
	/** @type {number} */
	height;
	/** @type {(idk: {x: number, y: number}, mouse: {x: number, y: number}) => { type: string, x: number, y: number }} */
	fragment;
	canvasDPI = 1;
	id = generateId();
	offset = 20;
	mouse = { x: 0, y: 0 };
	mouseUsed = false;
	constructor(options = {}) {
		this.width = options.width ?? 100;
		this.height = options.height ?? 100;
		this.fragment = options.fragment ?? ((uv) => texture(uv.x, uv.y));
		this.canvasDPI = 1;
		this.id = generateId();
		this.offset = 20;

		this.mouse = { x: 0, y: 0 };
		this.mouseUsed = false;

		this.createElement();
		this.setupEventListeners();
		this.updateShader();
	}

	createElement() {
		this.container = document.createElement('div');
		this.container.style.cssText = `
      position: fixed;
      width: ${this.width}px;
      height: ${this.height}px;
      overflow: hidden;
      border-radius: 50px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 -10px 30px inset rgba(0, 0, 0, 0.2);
      cursor: grab;
      backdrop-filter: url(#${this.id}_filter) blur(1px) contrast(1.3) brightness(1.1) saturate(1.4);
      z-index: 9999;
      pointer-events: auto;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
    `;

		this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		this.svg.setAttribute('width', '0');
		this.svg.setAttribute('height', '0');
		this.svg.style.position = 'fixed';
		this.svg.style.pointerEvents = 'none';

		const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
		const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
		filter.id = `${this.id}_filter`;
		filter.setAttribute('filterUnits', 'userSpaceOnUse');

		this.feImage = document.createElementNS('http://www.w3.org/2000/svg', 'feImage');
		this.feDisplacementMap = document.createElementNS('http://www.w3.org/2000/svg', 'feDisplacementMap');
		this.feDisplacementMap.setAttribute('in', 'SourceGraphic');
		this.feDisplacementMap.setAttribute('in2', `${this.id}_map`);
		this.feDisplacementMap.setAttribute('xChannelSelector', 'R');
		this.feDisplacementMap.setAttribute('yChannelSelector', 'G');

		filter.appendChild(this.feImage);
		filter.appendChild(this.feDisplacementMap);
		defs.appendChild(filter);
		this.svg.appendChild(defs);

		this.canvas = document.createElement('canvas');
		this.canvas.width = this.width * this.canvasDPI;
		this.canvas.height = this.height * this.canvasDPI;
		this.canvas.style.display = 'none';
		this.context = this.canvas.getContext('2d');
	}

	constrainPosition(x, y) {
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const minX = this.offset;
		const maxX = vw - this.width - this.offset;
		const minY = this.offset;
		const maxY = vh - this.height - this.offset;
		return { x: Math.max(minX, Math.min(maxX, x)), y: Math.max(minY, Math.min(maxY, y)) };
	}

	setupEventListeners() {
		let isDragging = false;
		let startX, startY, initialX, initialY;

		this.container.addEventListener('mousedown', (e) => {
			isDragging = true;
			this.container.style.cursor = 'grabbing';
			startX = e.clientX;
			startY = e.clientY;
			const rect = this.container.getBoundingClientRect();
			initialX = rect.left;
			initialY = rect.top;
			e.preventDefault();
		});

		document.addEventListener('mousemove', (e) => {
			if (isDragging) {
				const deltaX = e.clientX - startX;
				const deltaY = e.clientY - startY;
				const newX = initialX + deltaX;
				const newY = initialY + deltaY;
				const constrained = this.constrainPosition(newX, newY);
				this.container.style.left = constrained.x + 'px';
				this.container.style.top = constrained.y + 'px';
				this.container.style.bottom = 'auto';
				this.container.style.transform = 'none';
			}

			const rect = this.container.getBoundingClientRect();
			this.mouse.x = (e.clientX - rect.left) / rect.width;
			this.mouse.y = (e.clientY - rect.top) / rect.height;
			if (this.mouseUsed) this.updateShader();
		});

		document.addEventListener('mouseup', () => {
			isDragging = false;
			this.container.style.cursor = 'grab';
		});

		window.addEventListener('resize', () => {
			const rect = this.container.getBoundingClientRect();
			const constrained = this.constrainPosition(rect.left, rect.top);
			this.container.style.left = constrained.x + 'px';
			this.container.style.top = constrained.y + 'px';
			this.container.style.transform = 'none';
		});
	}

	updateShader() {
		const mouseProxy = new Proxy(this.mouse, {
			get: (target, prop) => {
				this.mouseUsed = true;
				return target[prop];
			}
		});

		this.mouseUsed = false;

		const w = this.width * this.canvasDPI;
		const h = this.height * this.canvasDPI;
		const data = new Uint8ClampedArray(w * h * 4);

		let maxScale = 0;
		const rawValues = [];

		for (let i = 0; i < data.length; i += 4) {
			const x = (i / 4) % w;
			const y = Math.floor(i / 4 / w);
			const pos = this.fragment(
				{ x: x / w, y: y / h },
				mouseProxy
			);
			const dx = pos.x * w - x;
			const dy = pos.y * h - y;
			maxScale = Math.max(maxScale, Math.abs(dx), Math.abs(dy));
			rawValues.push(dx, dy);
		}

		maxScale *= 0.5;

		let index = 0;
		for (let i = 0; i < data.length; i += 4) {
			const r = rawValues[index++] / maxScale + 0.5;
			const g = rawValues[index++] / maxScale + 0.5;
			data[i] = r * 255;
			data[i + 1] = g * 255;
			data[i + 2] = 0;
			data[i + 3] = 255;
		}

		this.context.putImageData(new ImageData(data, w, h), 0, 0);
		this.feImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', this.canvas.toDataURL());
		this.feDisplacementMap.setAttribute('scale', (maxScale / this.canvasDPI).toString());
	}

	appendChild(child) {
		this.container.appendChild(child);
	}

	appendTo(parent) {
		parent.appendChild(this.svg);
		parent.appendChild(this.container);
	}

	destroy() {
		this.svg.remove();
		this.container.remove();
		this.canvas.remove();
	}
}

export default Shader;
