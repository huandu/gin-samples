$(function() {
	const MOUSE_LBUTTON = 0;
	const MOUSE_RBUTTON = 2;
	
	const STATUS_STOPPED = 0;
	const STATUS_RUNNING = 1;
	const STATUS_LOST_FOCUS = 2;
	
	const FLOAT_ZERO = 1e-3;
	
	const GAME_CANVAS_WIDTH = 800;
	const GAME_CANVAS_HEIGHT = 400;
	const GAME_CANVAS_BORDER = 10;
	
	const GAME_SHAPE_RADIUS = 100;
	const GAME_SHAPE_RADIUS_DELTA = .5;
	const GAME_SHAPE_LINE_WIDTH = 2;
	const GAME_SHAPE_SHADOW_BLUR = 10;
	const GAME_SHAPE_MOVEMENT = 10;
	const GAME_SHAPE_MOVEMENT_DELTA = 6;
	const GAME_SHAPE_SPIN = 0.04;
	const GAME_SHAPE_SPIN_DELTA = 0.01;
	const GAME_FRAGMENT_RADIUS = 40;
	
	const GAME_MOUSETRACER_LINE_WIDTH = 4;
	const GAME_MOUSETRACER_DOT_AGE = 7;
	const GAME_MOUSETRACER_EVENT_AGE = 7;
	const GAME_MOUSETRACER_AGE_DIFF = GAME_MOUSETRACER_DOT_AGE - GAME_MOUSETRACER_EVENT_AGE;
	const GAME_MOUSETRACER_SHADOW_BLUR = 20;
    
    const GAME_FADE_DURANCE = 800;
	
	const GAME_LIFE = 5;
	
	var statusMsg = [
		'stopped', 'running', 'lost focus'
	];
	
	var stats = {
		fps: 0,
		mps: 0,
		status: STATUS_STOPPED
	};
	
	var _updateStats = function(e) {
		var s = e.stats;
		
		if (s.fps != stats.fps) {
			$('#fps').text(s.fps);
			stats.fps = s.fps;
		}
		
		if (s.mps != stats.mps) {
			$('#mps').text(s.mps);
			stats.mps = s.mps;
		}
		
		var status = e.hasFocus? STATUS_RUNNING: STATUS_LOST_FOCUS;
		
		if (stats.status != status) {
			$('#status').text(statusMsg[status]);
			stats.status = status;
		}
		
		$('#mouseX').text(e.clientX);
		$('#mouseY').text(e.clientY);
	};
	
	function MouseTracer() {}
    MouseTracer.create = function() {
        return (new MouseTracer()).init();
    };
	MouseTracer.prototype = {
		init: function() {
			this.dots = [];
			this.events = [];
			this.colorR = '';
			this.colorG = '';
			this.resetting = true;
			
			return this;
		},
		add: function(e) {
			var newDot = false;
			
			if (this.resetting) {
				this.colorR = 200 + Math.ceil(Math.random() * 55);
				this.colorG = 200 + Math.ceil(Math.random() * 55);
				this.resetting = false;
				this.events = [];
				newDot = true;
			}
			
			this.dots.push({
				x: e.clientX,
				y: e.clientY,
				age: GAME_MOUSETRACER_DOT_AGE,
				r: this.colorR,
				g: this.colorG,
				isNew: newDot
			});
			this.events.push({
				x: e.clientX,
				y: e.clientY,
				timeStamp: e.timeStamp,
				age: GAME_MOUSETRACER_EVENT_AGE
			});
		},
		reset: function() {
			this.resetting = true;
		},
		render: function(e) {
			var ctx = e.context,
				previous = null;
			
			for (var i in this.dots) {
				var dot = this.dots[i];
				
				if (previous && !dot.isNew) {
					var b = 255 - dot.age * Math.floor(250 / GAME_MOUSETRACER_DOT_AGE),
						a = 0.8,
						lineWidth = Math.max(1, Math.round(GAME_MOUSETRACER_LINE_WIDTH * dot.age / GAME_MOUSETRACER_DOT_AGE)),
						shadowColor = 'rgba(' + dot.r + ',' + dot.g + ',' + b + ',' + a + ')',
						strokeStyle = dot.age > GAME_MOUSETRACER_AGE_DIFF?
							'rgb(' + dot.r + ',' + dot.g + ',' + b + ')': shadowColor;

					ctx.lineWidth = lineWidth;
					ctx.lineCap = 'round';
					ctx.lineJoin = 'round';
					ctx.shadowBlur = GAME_MOUSETRACER_SHADOW_BLUR;
					ctx.shadowColor = shadowColor;
					ctx.strokeStyle = strokeStyle;
					ctx.beginPath();
					ctx.moveTo(previous.x, previous.y);
					ctx.lineTo(dot.x, dot.y);
					ctx.stroke();
				}
				
				previous = {
					x: dot.x,
					y: dot.y
				};
				dot.age--;
				
				if (!dot.age) {
					delete this.dots[i];
				}
			}
			
			for (var i in this.events) {
				this.events[i].age--;
				
				if (!this.events[i].age) {
					delete this.events[i];
				}
			}
		},
		traverse: function(self, callback) {
			var cur, prev;
			
			for (var i in this.events) {
				cur = this.events[i];
				
				if (prev) {
					callback.call(self, cur, prev);
				}
				
				prev = cur;
			}
		}
	};
	
	function Polygon() {}
	Polygon.create = function(settings) {
		return (new Polygon()).init(settings);
	};
	Polygon.prototype = {
		init: function(settings) {
			var s = settings || {},
				
				// required settings. caller must be sane enough to provide correct settings.
				w = s.width,
				h = s.height,
				r = s.r,
				g = s.g,
				b = s.b,
				a = s.a,
				radius = s.radius,
				direction = s.direction,
				fillStyle = s.fillStyle || 'rgba(' + r + ',' + g + ',' + b + ',' + a * 0.15 + ')',
				strokeStyle = s.strokeStyle || 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')',
				shadowColor = s.shadowColor || 'rgba(' + r + ',' + g + ',' + b + ',' + a * 0.8 + ')',
				mA = s.mA,
				mB = s.mB,
				mC = s.mC,
				mD = s.mD,
				x = s.x,
				y = s.y,
				radDelta = s.radDelta,
				edges = s.edges,
				hasDeathBomb = s.hasDeathBomb,
				
				rads = this._generateRads(edges),
				points = this._updatePoints(x, y, radius, rads);

			this.shape = {
				radius: radius,
				direction: direction,
				
				// y = mA*(x - mB)^2 + mC
				mA: mA,
				mB: mB,
				mC: mC,
				mD: mD, // x += mD in each rendering loop
				radDelta: radDelta,
				rads: rads,
				points: points,
				r: r,
				g: g,
				b: b,
				a: a,
				strokeStyle: strokeStyle,
				fillStyle: fillStyle,
				shadowColor: shadowColor,
				lineWidth: GAME_SHAPE_LINE_WIDTH,
				shadowBlur: GAME_SHAPE_SHADOW_BLUR
			};
			
			if (hasDeathBomb) {
				var r = 255 - Math.round(100 * Math.random()),
					g = 0,
					b = 0,
					a = 1;
				
				this.bomb = {
					r: r,
					g: g,
					b: b,
					a: a,
					gradientRadius: (1 - 2.25/edges) * radius,
					gradientStartColor: 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')',
					gradientEndColor: 'rgba(' + r + ',' + g + ',' + b + ',' + a * 0.2 + ')'
				};
			}
			
			this.x = x;
			this.y = y;
			this.width = w;
			this.height = h;
			this.edges = edges;
			this.hasDeathBomb = hasDeathBomb;
			this.timeStamp = Date.now();
			
			return this;
		},
		render: function(e) {
			var ctx = e.context,
				shape = this.shape,
				x = this.x,
				y = this.y,
				points = shape.points;
			
			ctx.save();
			ctx.beginPath();
			ctx.strokeStyle = shape.strokeStyle;
			ctx.fillStyle = shape.fillStyle;
			ctx.lineWidth = shape.lineWidth;
			ctx.shadowColor = shape.shadowColor;
			ctx.shadowBlur = shape.shadowBlur;
			ctx.moveTo(points[0].x, points[0].y);
			
			for (var i = points.length - 1; i >= 0; i--) {
				ctx.lineTo(points[i].x, points[i].y);
			}
			
			ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
			ctx.stroke();
			ctx.shadowBlur = 0;
			ctx.fill();
			ctx.restore();
			
			if (this.hasDeathBomb) {
				var bomb = this.bomb,
					grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, bomb.gradientRadius);
				
				grad.addColorStop(0, bomb.gradientStartColor);
				grad.addColorStop(1, bomb.gradientEndColor);
				ctx.fillStyle = grad;
				ctx.beginPath();
				ctx.arc(this.x, this.y, bomb.gradientRadius, 0, Math.PI * 2, true);
				ctx.fill();
			}
			
			this.x += shape.mD;
			this.y = shape.mA * (this.x - shape.mB) * (this.x - shape.mB) + shape.mC;
			this._updateRads(shape.rads, shape.radDelta);
			shape.points = this._updatePoints(this.x, this.y, shape.radius, shape.rads);
		},
		hitTest: function(cur, prev) {
			var points = this.shape.points,
				length = points.length;
			
			if (cur.timeStamp < this.timeStamp || prev.timeStamp < this.timeStamp) {
				return false;
			}
			
			for (var i = 0, j = i + 1; i < length; i++, j = (j + 1) % length) {
				if ((this._lineTest(cur.x, cur.y, prev.x, prev.y, points[i].x, points[i].y, points[j].x, points[j].y)
					&& (this._insideBox(points[i].x, points[i].y) || this._insideBox(points[j].x, points[j].y)))) {
					return true;
				}
			}
			
			return false;
		},
		life: function() {
			var shape = this.shape;
			
			return (
				(this.y > shape.radius + this.height)
					|| (shape.direction < 0 && this.x < -shape.radius)
					|| (shape.direction > 0 && this.x > shape.radius + this.width)
				? 0: 1
			);
		},
		spawn: function() {
			// spawn new polygons, fragments and/or bombs
			var polygons = [],
				bombs = [],
				fragments = [],
				newEdges = [Math.ceil(this.edges / 2.) + 1, Math.floor(this.edges / 2.) + 1],
				shape = this.shape,
				spawnBomb = this.hasDeathBomb,
				bombInShape = Math.random();
			
			if (this.edges > 3) {
				var w = 2 * shape.radius,
					h = this.height + shape.radius - this.y,
					direction = Math.random() < 0.5? 1: -1,
					mB, mC, x, y, deathBomb;

				for (var i in newEdges) {
					direction = -direction;
					mC = Math.max(-shape.radius, this.y - 2 * shape.radius * Math.random());
					
					if (direction > 0) {
						mB = this.x + 0.5 * shape.radius + w * Math.random();
					} else {
						mB = this.x - 0.5 * shape.radius - w * Math.random();
					}
					
					x = this.x + direction * 0.5 * shape.radius;
					y = shape.mA * (x - mB) * (x - mB) + mC;
					bombInShape -= 0.33;
					
					if (bombInShape < 0 && spawnBomb) {
						spawnBomb = false;
						deathBomb = true;
					} else {
						deathBomb = false;
					}

					polygons.push(Polygon.create({
						width: this.width,
						height: this.height,
						radius: shape.radius,
						direction: direction,
						fillStyle: shape.fillStyle,
						strokeStyle: shape.strokeStyle,
						shadowColor: shape.shadowColor,
						r: shape.r,
						g: shape.g,
						b: shape.b,
						a: shape.a,
						mA: shape.mA,
						mB: mB,
						mC: mC,
						mD: direction * Math.abs(shape.mD),
						x: x,
						y: y,
						radDelta: shape.radDelta,
						edges: newEdges[i],
						hasDeathBomb: deathBomb,
					}));
				}
			} else {
				var fragCnt = 2 * Math.round(shape.radius / GAME_FRAGMENT_RADIUS);
				
				for (var i = 0; i < fragCnt; i++) {
					var w = 2 * shape.radius,
						h = this.height + shape.radius - this.y,
						direction = Math.random() < 0.5? 1: -1,
						mB = this.x - shape.radius + w * Math.random(),
						mC = this.y + shape.radius * Math.random();

					fragments.push(Polygon.create({
						width: this.width,
						height: this.height,
						radius: GAME_FRAGMENT_RADIUS - Math.round(GAME_SHAPE_RADIUS_DELTA * GAME_FRAGMENT_RADIUS * Math.random()),
						direction: direction,
						fillStyle: 'transparent',
						strokeStyle: 'rgb(' + (shape.r - 150) + ',' + (shape.g - 150) + ',' + (shape.b - 150) + ')',
						shadowColor: 'transparent',
						r: shape.r - 150,
						g: shape.g - 150,
						b: shape.b - 150,
						a: 1,
						mA: shape.mA * (2 + 2 * Math.random()),
						mB: mB,
						mC: mC,
						mD: direction * Math.abs(shape.mD),
						x: this.x,
						y: this.y,
						radDelta: shape.radDelta,
						edges: 3,
						hasDeathBomb: false,
					}));
				}
			}
			
			if (spawnBomb) {
				var w = 2 * shape.radius,
					h = this.height + shape.radius - this.y,
					direction = Math.random() < 0.5? 1: -1,
					mC = this.y + 0.5 * shape.radius * Math.random(),
					bomb = this.bomb;
					
					if (direction > 0) {
						mB = this.x + 0.5 * shape.radius + w * Math.random();
					} else {
						mB = this.x - 0.5 * shape.radius - w * Math.random();
					}
					
					var x = this.x + direction * 0.5 * shape.radius,
						y = shape.mA * (x - mB) * (x - mB) + mC;

				bombs.push(Bomb.create({
					width: this.width,
					height: this.height,
					radius: bomb.gradientRadius,
					direction: direction,
					r: bomb.r,
					g: bomb.g,
					b: bomb.b,
					a: bomb.a,
					mA: shape.mA * (2 + 2 * Math.random()),
					mB: mB,
					mC: mC,
					mD: direction * Math.abs(shape.mD),
					x: x,
					y: y,
					radDelta: shape.radDelta
				}));
			}
			
			return {
				polygons: polygons,
				bombs: bombs,
				fragments: fragments
			}
		},
		// check whether lines (x1, y1)-(x2, y2) and (x3, y3)-(x4, y4) are crossed
		_lineTest: function(x1, y1, x2, y2, x3, y3, x4, y4) {
			return (
				((x2 - x1)*(y3 - y1) - (x3 - x1)*(y2 - y1)) * ((x2 - x1)*(y4 - y1) - (x4 - x1)*(y2 - y1)) <= 0
				&& ((x4 - x3)*(y1 - y3) - (x1 - x3)*(y4 - y3)) * ((x4 - x3)*(y2 - y3) - (x2 - x3)*(y4 - y3)) <= 0
			);
		},
		_insideBox: function(x, y) {
			return x >= 0 && y >= 0 && x <= this.width && y <= this.height;
		},
		_generateRads: function(edges) {
			var rads = [],
				offset = 2 * Math.random();
			
			for (var i = 0; i < edges; i++) {
				rads.push((2 * .3 / edges * Math.random() + offset + i * 2 / edges) * Math.PI);
			}
			
			return rads;
		},
		_updateRads: function(rads, delta) {
			for (var i = 0; i < rads.length; i++) {
				rads[i] += delta;
			}
		},
		_updatePoints: function(x, y, radius, rads) {
			var points = [];
			
			for (var i in rads) {
				points.push({
					x: x + radius * Math.cos(rads[i]),
					y: y + radius * Math.sin(rads[i])
				});
			}
			
			return points;
		}
	};
	
	function Bomb() {}
	Bomb.create = function(settings) {
		return (new Bomb()).init(settings);
	};
	Bomb.prototype = {
		init: function(settings) {
			var s = settings || {},
			
				// caller must be sane
				w = s.width,
				h = s.height,
				radius = s.radius,
				radDelta = s.radDelta,
				direction = s.direction,
				mA = s.mA,
				mB = s.mB,
				mC = s.mC,
				mD = s.mD,
				x = s.x,
				y = s.y,
				r = s.r,
				g = s.g,
				b = s.b,
				a = s.a,
				
				startRad = 2 * Math.random();
			
			this.shape = {
				radius: radius,
				startRad: startRad,
				radDelta: radDelta,
				direction: direction,
				mA: mA,
				mB: mB,
				mC: mC,
				mD: mD,
				strokeStyle: 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')',
				gradientRadius: 1.3 * radius,
				gradientStartColor: 'rgba(' + r + ',' + g + ',' + b + ',' + a * 0.5 + ')',
				gradientEndColor: 'rgba(' + r + ',' + g + ',' + b + ',' + a * 0.2 + ')',
				crossRadius: radius * 0.8
			};
			this.width = w;
			this.height = h;
			this.x = x;
			this.y = y;
			this.timeStamp = Date.now();
			
			return this;
		},
		render: function(e) {
			var ctx = e.context
				shape = this.shape;
			
            ctx.save();
			ctx.beginPath();
			ctx.strokeStyle = shape.strokeStyle;
			ctx.lineWidth = GAME_SHAPE_LINE_WIDTH;
			ctx.arc(this.x, this.y, shape.radius, 0, Math.PI * 2, true);
			ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(this.x + shape.crossRadius * Math.cos(shape.startRad),
                this.y + shape.crossRadius * Math.sin(shape.startRad));
            ctx.lineTo(this.x + shape.crossRadius * Math.cos(shape.startRad + Math.PI),
                this.y + shape.crossRadius * Math.sin(shape.startRad + Math.PI));
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(this.x + shape.crossRadius * Math.cos(shape.startRad + .5 * Math.PI),
                this.y + shape.crossRadius * Math.sin(shape.startRad + .5 * Math.PI));
            ctx.lineTo(this.x + shape.crossRadius * Math.cos(shape.startRad + 1.5 * Math.PI),
                this.y + shape.crossRadius * Math.sin(shape.startRad + 1.5 * Math.PI));
            ctx.stroke();
            ctx.restore();
            
            ctx.save();
            var grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, shape.gradientRadius);
            grad.addColorStop(0, shape.gradientStartColor);
            grad.addColorStop(1, shape.gradientEndColor);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(this.x, this.y, shape.radius, 0, 2 * Math.PI, true);
            ctx.fill();
            ctx.restore();
			
			this.x += shape.mD;
			this.y = shape.mA * (this.x - shape.mB) * (this.x - shape.mB) + shape.mC;
            shape.startRad += shape.radDelta;
            
            if (shape.startRad > 2 * Math.PI) {
                shape.startRad -= 2 * Math.PI;
            }
		},
		hitTest: function(cur, prev) {
			var shape = this.shape;
			
			if (cur.timeStamp < this.timeStamp || prev.timeStamp < this.timeStamp) {
				return false;
			}
			
			if (Math.abs(cur.x - prev.x) < FLOAT_ZERO) {
				if (Math.abs(this.x - cur.x) > shape.radius) {
					return false;
				}
				
				if (this.y > Math.max(cur.y, prev.y) || this.y < Math.min(cur.y, prev.y)) {
					return false;
				}
				
				return true;
			}
			
			var r1 = (cur.x - this.x)*(cur.x - this.x) + (cur.y - this.y)*(cur.y - this.y),
				r2 = (prev.x - this.x)*(prev.x - this.x) + (prev.y - this.y)*(prev.y - this.y),
				r = shape.radius * shape.radius;
				
			
			if (r1 <= r || r2 <= r) {
				return true;
			}
			
			var k = (cur.y - prev.y) / (cur.x - prev.x),
				x0 = (k*k * prev.x + k * (this.y - prev.x) + this.x) / (k*k + 1),
				y0 = k * (x0 - prev.x) + prev.y,
				r0 = (x0 - this.x)*(x0 - this.x) + (y0 - this.y)*(y0 - this.y);
			
			if (r0 <= r && x0 <= Math.max(cur.x, prev.x) && x0 >= Math.min(cur.x, prev.x)) {
				return true;
			}
			
			return false;
		},
		life: function() {
			var shape = this.shape;
			
			return (
				(shape.direction < 0 && this.x < -shape.radius)
					|| (shape.direction > 0 && this.x > shape.radius + this.width)
					|| this.y > shape.radius + this.height
				? 0: 1
			);
		}
	};
	
	function ShapeManager() {}
	ShapeManager.create = function(layer) {
		return (new ShapeManager()).init(layer);
	};
	ShapeManager.prototype = {
		init: function(layer) {
			this.shapes = [];
			this.bombs = [];
			this.fragments = [];
			this.layer = layer;
			this.width = layer.width();
			this.height = layer.height();
            
			this.minRunningShapes = 1;
            this.edgeDelta = 0;
            this.bombChance = 0;
            this.mDExtra = 0;
			
			return this;
		},
		render: function(e) {
			var shapes = this.shapes,
				bombs = this.bombs,
				fragments = this.fragments,
				life = this.layer.data('life'),
				runningShapes = 0;
			
			for (var i in shapes) {
				if (!shapes[i].life()) {
					life--;
					delete shapes[i];
					continue;
				}
				
				shapes[i].render(e);
				runningShapes++;
			}
			
			for (var i in bombs) {
				if (!bombs[i].life()) {
					delete bombs[i];
					continue;
				}
				
				bombs[i].render(e);
			}
			
			for (var i in fragments) {
				if (!fragments[i].life()) {
					delete fragments[i];
					continue;
				}
				
				fragments[i].render(e);
			}
			
			if (life <= 0) {
				this.layer.stop();
			}
			
			this.layer.data('life', life);
			
			if (runningShapes < this.minRunningShapes) {
				for (var i = this.minRunningShapes - runningShapes; i > 0; i--) {
					this.shapes.push(this._randomPolygon());
				}
			}
			
			return this;
		},
		hit: function(cur, prev) {
			if ((cur.x < 0 || cur.x > this.width || cur.y < 0 || cur.y > this.height)
				&& (prev.x < 0 || prev.x > this.width || prev.y < 0 || prev.y > this.height)) {
				return 0;
			}
			
			var shapes = this.shapes,
				bombs = this.bombs,
				fragments = this.fragments,
				hit = 0,
				life = this.layer.data('life'),
				newPolygons = [],
				newBombs = [],
				newFragments = [];
			
			for (var i in shapes) {
				if (shapes[i].hitTest(cur, prev)) {
					var newShapes = shapes[i].spawn();
					newPolygons = newPolygons.concat(newShapes.polygons);
					newBombs = newBombs.concat(newShapes.bombs);
					newFragments = newFragments.concat(newShapes.fragments);
					
					delete shapes[i];
					hit++;
				}
			}
			
			for (var i in bombs) {
				if (bombs[i].hitTest(cur, prev)) {
					life--;
					delete bombs[i];
				}
			}
			
			this.shapes = this.shapes.concat(newPolygons);
			this.bombs = this.bombs.concat(newBombs);
			this.fragments = this.fragments.concat(newFragments);
			this.layer.data('life', life);
			
			return hit;
		},
		addHits: function(hits) {
			var newHits = this.layer.data('hits') + hits;
			
            this.minRunningShapes = Math.floor(Math.log(newHits) / 4) + 1;
            this.edgeDelta = newHits / 40;
            this.bombChance = newHits / 500;
            this.mDExtra = newHits / 100;
			
			this.layer.data('hits', newHits);
			return this;
		},
		_randomPolygon: function() {
			var radius = GAME_SHAPE_RADIUS - Math.round(GAME_SHAPE_RADIUS_DELTA * GAME_SHAPE_RADIUS * Math.random()),
				direction = Math.random() > 0.5? 1: -1,
				r = Math.round(Math.random() * 70 + 185),
				g = Math.round(Math.random() * 70 + 185),
				b = Math.round(Math.random() * 70 + 185),
				a = 1,
				mA = 0.0017 + Math.random() * 0.0003,
				mB = this.width * (1 / 8 + Math.random() * 3 / 4),
				mC = this.height * (1 / 16 + Math.random() / 3),
				y = radius + this.height - 1,
				x = (-direction * Math.sqrt((y - mC) / mA) + mB),
				anticlock = Math.random() > 0.5? 1: -1;
				
			return (
				(new Polygon()).init({
					width: this.width,
					height: this.height,
					radius: radius,
					direction: direction,
					r: r,
					g: g,
					b: b,
					a: a,
					mA: mA,
					mB: mB,
					mC: mC,
					mD: direction * (this.mDExtra + GAME_SHAPE_MOVEMENT + Math.round(GAME_SHAPE_MOVEMENT_DELTA * Math.random())),
					x: x,
					y: y,
					radDelta: anticlock * (Math.random() * GAME_SHAPE_SPIN_DELTA + GAME_SHAPE_SPIN),
					edges: 3 + Math.round(this.edgeDelta * Math.random()),
					hasDeathBomb: Math.random() < this.bombChance? true: false
				})
			);
		}
	};
	
	$G('device', {}, {
		start: function(){
			var $score_panel = $('#score_panel').detach(),
				$life_panel = $('#life_panel').detach(),
				$menu_panel = $('#menu_panel').detach(),
				$about_panel = $('#about_panel').detach(),
				$stats_panel = $('#stats_panel').detach(),
                $hint_panel = $('#hint_panel').detach(),
                $help_panel = $('#help_panel').detach();
			
			this.layers('background', {
				left: Math.max((this.core().width() - GAME_CANVAS_WIDTH) / 2 - GAME_CANVAS_BORDER, 0),
				top: 40,
				width: GAME_CANVAS_WIDTH + 2 * GAME_CANVAS_BORDER,
				height: GAME_CANVAS_HEIGHT + 2 * GAME_CANVAS_BORDER
			}, {
				play: function() {
					this.draw(function(e) {
						var ctx = e.context;
						ctx.fillStyle = 'rgb(32,32,32)';
						ctx.rect(0, 0, this.width(), this.height());
						ctx.fill();
						ctx.clearRect(GAME_CANVAS_BORDER, GAME_CANVAS_BORDER,
							this.width() - 2 * GAME_CANVAS_BORDER, this.height() - 2 * GAME_CANVAS_BORDER);
					})
					.layers('main', {
						left: GAME_CANVAS_BORDER,
						top: GAME_CANVAS_BORDER,
						width: GAME_CANVAS_WIDTH,
						height: GAME_CANVAS_HEIGHT,
						hidden: true,
						autoPlay: false
					}, {
						play: function() {
							this.data('shape_manager', ShapeManager.create(this))
							.data('mouse_tracer', MouseTracer.create())
							.data('triangle_count', 0)
							.data('triangle_level', 1)
							.data('hits', 0, function(value) {
								$('#score').text(value);
							})
							.data('life', GAME_LIFE, function(cur, prev) {
								if (cur != prev) {
									$('#life').text(cur);
								}
							})
							.layers('score', {
								left: GAME_CANVAS_BORDER + 5,
								top: GAME_CANVAS_BORDER + 5,
								attachment: $score_panel[0]
							})
							.layers('life', {
								left: GAME_CANVAS_BORDER + GAME_CANVAS_WIDTH - 130,
								top: GAME_CANVAS_BORDER + 5,
								attachment: $life_panel[0]
							});
						},
                        stop: function() {
                            _setHighScore(this.data('hits'));
                            
                            var self = this;
                            $(this.element()).fadeOut(GAME_FADE_DURANCE, function() {
                                self.draw(function(e) {
                                    e.context.clearRect(0, 0, this.width(), this.height());
                                });
                            });
                            $(this.parent().layers('menu').play().element()).fadeIn(GAME_FADE_DURANCE);
                        },
						beforerender: function(e) {
							var tracer = this.data('mouse_tracer'),
								manager = this.data('shape_manager'),
								hits = 0;

							if (e.buttonStates[MOUSE_LBUTTON]) {
								e.traverseHistory(function(cur, prev) {
									tracer.add(cur);
								});
							} else {
								tracer.reset();
							}
							
							tracer.traverse(this, function(cur, prev) {
								hits += manager.hit(cur, prev);
							});
							
							if (hits) {
								manager.addHits(hits);
							}
						},
						render: function(e) {
							e.context.clearRect(0, 0, this.width(), this.height());
							
							this.data('shape_manager').render(e);
							this.data('mouse_tracer').render(e);
						}
					})
					.layers('menu', {
						left: GAME_CANVAS_BORDER,
						top: GAME_CANVAS_BORDER,
                        width: GAME_CANVAS_WIDTH,
                        height: GAME_CANVAS_HEIGHT,
						attachment: $menu_panel[0]
					}, {
						play: function() {
							$('#highscore').text(_getHighScore());
							
							this.data('mouse_tracer', MouseTracer.create())
                            .data('triangle_play', Polygon.create({
                                width: this.width(),
                                height: this.height(),
                                radius: 80,
                                direction: 1,
                                r: Math.round(Math.random() * 70 + 185),
                                g: Math.round(Math.random() * 70 + 185),
                                b: Math.round(Math.random() * 70 + 185),
                                a: 1,
                                mA: 305/(300*300),
                                mB: 0,
                                mC: 0,
                                mD: 0,
                                x: 300,
                                y: 305,
                                radDelta: (Math.random() < .5? 1: -1) * (Math.random() * GAME_SHAPE_SPIN_DELTA + GAME_SHAPE_SPIN),
                                edges: 3,
                                hasDeathBomb: false
                            }))
                            .data('triangle_help', Polygon.create({
                                width: this.width(),
                                height: this.height(),
                                radius: 80,
                                direction: 1,
                                r: Math.round(Math.random() * 70 + 185),
                                g: Math.round(Math.random() * 70 + 185),
                                b: Math.round(Math.random() * 70 + 185),
                                a: 1,
                                mA: 305/(500*500),
                                mB: 0,
                                mC: 0,
                                mD: 0,
                                x: 500,
                                y: 305,
                                radDelta: (Math.random() < .5? 1: -1) * (Math.random() * GAME_SHAPE_SPIN_DELTA + GAME_SHAPE_SPIN),
                                edges: 3,
                                hasDeathBomb: false
                            }))
                            .data('hiding', false)
                            .data('switchTo', null)
							.layers('about', {
								left: 0,
								top: -40,
								dialogMode: true,
								attachment: $about_panel[0]
							})
                            .layers('hint', {
                                left: 0,
                                top: 380,
                                width: this.width(),
                                height: 20,
                                attachment: $hint_panel[0]
                            }, {
                                play: function() {
                                    var self = this;
                                    $hint_panel.fadeOut(GAME_FADE_DURANCE, function() {
                                        self.stop();
                                    });
                                },
                                stop: function() {
                                    var self = this;
                                    $hint_panel.fadeIn(GAME_FADE_DURANCE, function() {
                                        self.play();
                                    });
                                }
                            });
						},
                        stop: function() {
                            if (this.data('switchTo')) {
                                this.draw(function(e) {
                                    e.context.clearRect(0, 0, this.width(), this.height());
                                });
                            
                                this.hide()
                                .parent().layers(this.data('switchTo'))
                                .play().show();
                            }
                        },
						beforerender: function(e) {
                            var isHitPlay = false,
                                isHitHelp = false,
                                tracer = this.data('mouse_tracer'),
                                play = this.data('triangle_play'),
                                help = this.data('triangle_help');

							if (e.buttonStates[MOUSE_LBUTTON] || e.buttonStates[MOUSE_RBUTTON]) {
								e.traverseHistory(function(cur, prev) {
									tracer.add(cur);
								});
							} else {
								tracer.reset();
							}
							
                            if (!this.data('hiding')) {
                                tracer.traverse(this, function(cur, prev) {
                                    if (play.hitTest(cur, prev)) {
                                        isHitPlay = true;
                                    }
                                    
                                    if (help.hitTest(cur, prev)) {
                                        isHitHelp = true;
                                    }
                                });
                            }
                            
                            if (isHitPlay) {
                                this.data('switchTo', 'main');
                            } else if (isHitHelp) {
                                this.data('switchTo', 'help');
                            }
                            
                            if (isHitPlay || isHitHelp) {
                                this.data('hiding', true);
                                
                                var self = this;
                                $(this.element()).fadeOut(GAME_FADE_DURANCE, function() {
                                    self.stop();
                                });
                            }
						},
                        render: function(e) {
							e.context.clearRect(0, 0, this.width(), this.height());
                            this.data('triangle_play').render(e);
                            this.data('triangle_help').render(e);
							this.data('mouse_tracer').render(e);
                        }
					})
                    .layers('help', {
 						left: GAME_CANVAS_BORDER,
						top: GAME_CANVAS_BORDER,
                        width: GAME_CANVAS_WIDTH,
                        height: GAME_CANVAS_HEIGHT,
                        autoPlay: false,
                        hidden: true,
						attachment: $help_panel[0]
                    }, {
                        play: function() {
 							this.data('mouse_tracer', MouseTracer.create())
                            .data('triangle_back', Polygon.create({
                                width: this.width(),
                                height: this.height(),
                                radius: 80,
                                direction: 1,
                                r: Math.round(Math.random() * 70 + 185),
                                g: Math.round(Math.random() * 70 + 185),
                                b: Math.round(Math.random() * 70 + 185),
                                a: 1,
                                mA: 305/(640*640),
                                mB: 0,
                                mC: 0,
                                mD: 0,
                                x: 640,
                                y: 305,
                                radDelta: (Math.random() < .5? 1: -1) * (Math.random() * GAME_SHAPE_SPIN_DELTA + GAME_SHAPE_SPIN),
                                edges: 3,
                                hasDeathBomb: false
                            }))
                            .data('triangle_simple', Polygon.create({
                                width: this.width(),
                                height: this.height(),
                                radius: 45,
                                direction: 1,
                                r: Math.round(Math.random() * 70 + 185),
                                g: Math.round(Math.random() * 70 + 185),
                                b: Math.round(Math.random() * 70 + 185),
                                a: 1,
                                mA: 160/(70*70),
                                mB: 0,
                                mC: 0,
                                mD: 0,
                                x: 70,
                                y: 160,
                                radDelta: (Math.random() < .5? 1: -1) * (Math.random() * GAME_SHAPE_SPIN_DELTA + GAME_SHAPE_SPIN),
                                edges: 3,
                                hasDeathBomb: false
                            }))
                            .data('triangle_with_bomb', Polygon.create({
                                width: this.width(),
                                height: this.height(),
                                radius: 45,
                                direction: 1,
                                r: Math.round(Math.random() * 70 + 185),
                                g: Math.round(Math.random() * 70 + 185),
                                b: Math.round(Math.random() * 70 + 185),
                                a: 1,
                                mA: 260/(70*70),
                                mB: 0,
                                mC: 0,
                                mD: 0,
                                x: 70,
                                y: 260,
                                radDelta: (Math.random() < .5? 1: -1) * (Math.random() * GAME_SHAPE_SPIN_DELTA + GAME_SHAPE_SPIN),
                                edges: 3,
                                hasDeathBomb: true
                            }))
                            .data('bomb', Bomb.create({
                                width: this.width(),
                                height: this.height(),
                                radius: 25,
                                direction: 1,
                                r: 255 - Math.round(100 * Math.random()),
                                g: 0,
                                b: 0,
                                a: 1,
                                mA: 360/(70*70),
                                mB: 0,
                                mC: 0,
                                mD: 0,
                                x: 70,
                                y: 360,
                                radDelta: (Math.random() < .5? 1: -1) * (Math.random() * GAME_SHAPE_SPIN_DELTA + GAME_SHAPE_SPIN),
                            }))
                            .data('quadrangle', Polygon.create({
                                width: this.width(),
                                height: this.height(),
                                radius: 45,
                                direction: 1,
                                r: Math.round(Math.random() * 70 + 185),
                                g: Math.round(Math.random() * 70 + 185),
                                b: Math.round(Math.random() * 70 + 185),
                                a: 1,
                                mA: 160/(460*460),
                                mB: 0,
                                mC: 0,
                                mD: 0,
                                x: 460,
                                y: 160,
                                radDelta: (Math.random() < .5? 1: -1) * (Math.random() * GAME_SHAPE_SPIN_DELTA + GAME_SHAPE_SPIN),
                                edges: 4,
                                hasDeathBomb: false
                            }))
                            .data('hiding', false);
                        },
                        stop: function() {
                            this.draw(function(e) {
                                e.context.clearRect(0, 0, this.width(), this.height());
                            });
                            
                            this.hide()
                            .parent().layers('menu')
                            .play().show();
                        },
                        beforerender: function(e) {
                            var isHitBack= false,
                                tracer = this.data('mouse_tracer'),
                                back = this.data('triangle_back');

							if (e.buttonStates[MOUSE_LBUTTON] || e.buttonStates[MOUSE_RBUTTON]) {
								e.traverseHistory(function(cur, prev) {
									tracer.add(cur);
								});
							} else {
								tracer.reset();
							}
							
                            if (!this.data('hiding')) {
                                tracer.traverse(this, function(cur, prev) {
                                    if (back.hitTest(cur, prev)) {
                                        isHitBack = true;
                                    }
                                });
                            }
                            
                            if (isHitBack) {
                                this.data('hiding', true);
                                
                                var self = this;
                                $(this.element()).fadeOut(GAME_FADE_DURANCE, function() {
                                    self.stop();
                                });
                            }
                        },
                        render: function(e) {
							e.context.clearRect(0, 0, this.width(), this.height());
                            this.data('triangle_back').render(e);
                            this.data('triangle_simple').render(e);
                            this.data('triangle_with_bomb').render(e);
                            this.data('bomb').render(e);
                            this.data('quadrangle').render(e);
							this.data('mouse_tracer').render(e);
                        }
                    });
				},
				beforerender: function(e) {
					_updateStats(e);
				},
				size: function(s) {
					this.left(Math.max((s.width - GAME_CANVAS_WIDTH) / 2 - GAME_CANVAS_BORDER, 0));
				}
			})
			.layers('status', {
				left: 5,
				top: 5,
				playable: false,
				attachment: $stats_panel[0]
			});
		},
		beforerender: function(e) {
			e.clearHistory();
		}
	});
});

var localStorage = window.localStorage || {},
    _setHighScore = function(score) {
        if (!localStorage.shapeBreakerHighscore || localStorage.shapeBreakerHighscore < score) {
            localStorage.shapeBreakerHighscore = score;
        }
    },
    _getHighScore = function() {
        return localStorage.shapeBreakerHighscore? localStorage.shapeBreakerHighscore: 0;
    },
    _resetHighScore = function() {
        localStorage.shapeBreakerHighscore = 0;
        $('#highscore').text(_getHighScore());
    };
