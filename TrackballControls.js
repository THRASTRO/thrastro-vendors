 /**
 * @author Eberhard Graether / http://egraether.com/
 * @author Mark Lundin 	/ http://mark-lundin.com
 * @author Simone Manini / http://daron1337.github.io
 * @author Luca Antiga 	/ http://lantiga.github.io
 */

  THREE.TrackballControls = function ( object, domElement ) {

	var _this = this;
	var ZOOM = { NONE: 0, IN: 1, OUT: 2 };
	var SPIN = { NONE: 0, LEFT: 1, RIGHT: 2 };
	var ROTATE = { NONE: 0, UP: 1, DOWN: 2, LEFT: 4, RIGHT: 8 };
	var MODIFIER = { NONE: 0, ALT: 1, CTRL: 2, SHIFT: 4, CAPSLOCK: 8 };
	var STATE = { NONE: - 1, ROTATE: 0, ZOOM: 1, PAN: 2, TOUCH_ROTATE: 3, TOUCH_ZOOM_PAN: 4 };

	this.object = object;
	this.domElement = ( domElement !== undefined ) ? domElement : document;

	// API

	var _tracking = new THREE.Vector3();

	this.enabled = true;

	this.screen = { left: 0, top: 0, width: 0, height: 0 };

	this.rotateSpeed = 0.9;
	this.zoomSpeed = 1.2;
	this.spinSpeed = 1.2;
	this.fovSpeed = 1.2;
	this.panSpeed = 0.3;

	this.looksAt = null;

	this.noRotate = false;
	this.noZoom = false;
	this.noSpin = false;
	this.noFov = false;
	this.noPan = false;

	this.staticMoving = false;
	this.dynamicDampingFactor = 0.15;

	this.minDistance = 0;
	this.maxDistance = Infinity;

	// this.keys = [ 65 /*A*/, 83 /*S*/, 68 /*D*/ ];

	this.keys = {
		'lock-rotate':  164,
		'lock-zoom': 183,
		'lock-pan': 168,

		'rotate-up': 87,
		'rotate-down': 83,
		'rotate-left': 65,
		'rotate-right': 68,

		'zoom-in': 81,
		'zoom-out': 69,

		'spin-left': 33,
		'spin-right': 34,

		'modifier-alt': 18,
		'modifier-ctrl': 17,
		'modifier-shift': 16,
		'modifier-capslock': 20,

		'focus': 70, // f

	};

	// internals

	this.target = new THREE.Vector3();

	// Item to look at
	this.tracking = null;

	var EPS = 0.000001;

	var lastPosition = new THREE.Vector3();

	this.zoom = ZOOM.NONE;
	this.spin = SPIN.NONE;
	this.rotate = ROTATE.NONE;
	this.modifier = MODIFIER.NONE;

	var _state = STATE.NONE,
		_prevState = STATE.NONE,

		_eye = new THREE.Vector3(),

		_movePrev = new THREE.Vector2(),
		_moveCurr = new THREE.Vector2(),

		_lastAxis = new THREE.Vector3(),
		_lastAngle = 0,

		_fovStart = 0,
		_fovEnd = 0,

		_zoomStart = 0,
		_zoomEnd = 0,

		_spinStart = 0,
		_spinEnd = 0,

		_touchZoomDistanceStart = 0,
		_touchZoomDistanceEnd = 0,

		_panStart = new THREE.Vector2(),
		_panEnd = new THREE.Vector2();

	// for reset

	this.target0 = this.target.clone();
	this.position0 = this.object.position.clone();
	this.up0 = this.object.up.clone();

	// events

	var changeEvent = { type: 'change' };
	var startEvent = { type: 'start' };
	var endEvent = { type: 'end' };


	// methods

	this.handleResize = function () {

		if ( this.domElement === document ) {

			this.screen.left = 0;
			this.screen.top = 0;
			this.screen.width = window.innerWidth;
			this.screen.height = window.innerHeight;

		} else {

			var box = this.domElement.getBoundingClientRect();
			// adjustments come from similar code in the jquery offset() function
			var d = this.domElement.ownerDocument.documentElement;
			this.screen.left = box.left + window.pageXOffset - d.clientLeft;
			this.screen.top = box.top + window.pageYOffset - d.clientTop;
			this.screen.width = box.width;
			this.screen.height = box.height;

		}

	};

	var getMouseOnScreen = ( function () {

		var vector = new THREE.Vector2();

		return function getMouseOnScreen( pageX, pageY ) {

			vector.set(
				( pageX - _this.screen.left ) / _this.screen.width,
				( pageY - _this.screen.top ) / _this.screen.height
			);

			return vector;

		};

	}() );

	var getMouseOnCircle = ( function () {

		var vector = new THREE.Vector2();

		return function getMouseOnCircle( pageX, pageY ) {

			vector.set(
				( ( pageX - _this.screen.width * 0.5 - _this.screen.left ) / ( _this.screen.width * 0.5 ) ),
				( ( _this.screen.height + 2 * ( _this.screen.top - pageY ) ) / _this.screen.width ) // screen.width intentional
			);

			return vector;

		};

	}() );

	this.rotateCamera = ( function () {

		var axis = new THREE.Vector3(),
			quaternion = new THREE.Quaternion(),
			eyeDirection = new THREE.Vector3(),
			objectUpDirection = new THREE.Vector3(),
			objectSidewaysDirection = new THREE.Vector3(),
			moveDirection = new THREE.Vector3(),
			angle;

		return function rotateCamera() {

			moveDirection.set( _moveCurr.x - _movePrev.x, _moveCurr.y - _movePrev.y, 0 );
			angle = moveDirection.length();

			if ( angle ) {

				_eye.copy( _this.object.position ).sub( _this.target );

				eyeDirection.copy( _eye ).normalize();
				objectUpDirection.copy( _this.object.up ).normalize();
				objectSidewaysDirection.crossVectors( objectUpDirection, eyeDirection ).normalize();

				objectUpDirection.setLength( _moveCurr.y - _movePrev.y );
				objectSidewaysDirection.setLength( _moveCurr.x - _movePrev.x );

				moveDirection.copy( objectUpDirection.add( objectSidewaysDirection ) );

				axis.crossVectors( moveDirection, _eye ).normalize();

				angle *= _this.rotateSpeed * _this.object.fov * Math.PI / 180.0;
				quaternion.setFromAxisAngle( axis, angle );

				_eye.applyQuaternion( quaternion );
				_this.object.up.applyQuaternion( quaternion );

				_lastAxis.copy( axis );
				_lastAngle = angle;

			} else if ( ! _this.staticMoving && _lastAngle ) {

				_lastAngle *= Math.sqrt( 1.0 - _this.dynamicDampingFactor );
				_eye.copy( _this.object.position ).sub( _this.target );
				quaternion.setFromAxisAngle( _lastAxis, _lastAngle );
				_eye.applyQuaternion( quaternion );
				_this.object.up.applyQuaternion( quaternion );

			}

			_movePrev.copy( _moveCurr );

		};

	}() );


	this.zoomCamera = function () {

		var fovFactor;
		var zoomFactor;

		if ( _state === STATE.TOUCH_ZOOM_PAN ) {

			factor = _touchZoomDistanceStart / _touchZoomDistanceEnd;
			_touchZoomDistanceStart = _touchZoomDistanceEnd;
			_eye.multiplyScalar( factor );

		} else {

			fovFactor = 1.0 + ( _fovEnd - _fovStart ) * _this.fovSpeed;

			if ( fovFactor !== 1.0 && fovFactor > 0.0 ) {

				if ( _this.staticMoving ) {

					_fovStart = _fovEnd;

				} else {

					_fovStart += ( _fovEnd - _fovStart ) * this.dynamicDampingFactor;

				}

				_this.object.fov *= fovFactor;

			}

			zoomFactor = 1.0 + ( _zoomEnd - _zoomStart ) * _this.zoomSpeed;

			if ( zoomFactor !== 1.0 && zoomFactor > 0.0 ) {

				_eye.multiplyScalar( zoomFactor );

			}

			if ( _this.staticMoving ) {

				_zoomStart = _zoomEnd;

			} else {

				_zoomStart += ( _zoomEnd - _zoomStart ) * this.dynamicDampingFactor;

			}

		}

	};

	this.spinCamera = ( function () {

		var factor = 1.0;

		var axis = new THREE.Vector3();
		var quaternion = new THREE.Quaternion();

		return function spinCamera() {

			factor = ( _spinEnd - _spinStart ) * _this.spinSpeed;

			if ( factor !== 0.0 ) {

				axis.copy(_this.object.position).normalize();
				quaternion.setFromAxisAngle(axis, -1 * factor);
				_this.object.up.applyQuaternion(quaternion);

			}

			if ( _this.staticMoving ) {

				_spinStart = _spinEnd;

			} else {

				_spinStart += ( _spinEnd - _spinStart ) * this.dynamicDampingFactor;

			}

		};

	}() );

	this.panCamera = ( function () {

		var mouseChange = new THREE.Vector2(),
			objectUp = new THREE.Vector3(),
			pan = new THREE.Vector3();

		return function panCamera() {

			mouseChange.copy( _panEnd ).sub( _panStart );

			if ( mouseChange.lengthSq() ) {

				mouseChange.multiplyScalar( _eye.length() * _this.panSpeed );

				pan.copy( _eye ).cross( _this.object.up ).setLength( mouseChange.x );
				pan.add( objectUp.copy( _this.object.up ).setLength( mouseChange.y ) );

				_this.object.position.add( pan );
				_this.target.add( pan );

				if ( _this.staticMoving ) {

					_panStart.copy( _panEnd );

				} else {

					_panStart.add( mouseChange.subVectors( _panEnd, _panStart ).multiplyScalar( _this.dynamicDampingFactor ) );

				}

			}

		};

	}() );

	this.checkDistances = function () {

		if ( _this.object.fov < 0.05 ) {
			_this.object.fov = 0.05;
		}
		if ( _this.object.fov > 160 ) {
			_this.object.fov = 160;
		}

		if ( ! _this.noZoom || ! _this.noPan ) {

			if ( _eye.lengthSq() > _this.maxDistance * _this.maxDistance ) {

				_this.object.position.addVectors( _this.target, _eye.setLength( _this.maxDistance ) );
				_zoomStart = _zoomEnd;
				_spinStart = _spinEnd;
				_fovStart = _fovEnd;

			}

			if ( _eye.lengthSq() < _this.minDistance * _this.minDistance ) {

				_this.object.position.addVectors( _this.target, _eye.setLength( _this.minDistance ) );
				_zoomStart = _zoomEnd;
				_spinStart = _spinEnd;
				_fovStart = _fovEnd;

			}

		}

	};

	this.update = function () {

		_eye.subVectors( _this.object.position, _this.target );

		if ( ! _this.noRotate ) {

			var factor = _this.rotateSpeed;
			
			if (_this.modifier != MODIFIER.NONE) {
				if (_this.modifier & MODIFIER.SHIFT) factor /= 8;
				if (_this.modifier & MODIFIER.CAPSLOCK) factor /= 16;
			}

			if ( _this.rotate != ROTATE.NONE) {
				if (_this.rotate & ROTATE.UP) _moveCurr.y -= 0.01 * factor;
				if (_this.rotate & ROTATE.DOWN) _moveCurr.y += 0.01 * factor;
				if (_this.rotate & ROTATE.LEFT) _moveCurr.x += 0.01 * factor;
				if (_this.rotate & ROTATE.RIGHT) _moveCurr.x -= 0.01 * factor;
			}

			_this.rotateCamera();

		}

		// ctrl+scroll is mostly reserved for zooming
		if ( ! _this.noZoom ) {

			var factor = _this.zoomSpeed;

			if (_this.modifier & MODIFIER.SHIFT) {
				factor = _this.fovSpeed;
				if (_this.modifier != MODIFIER.NONE) {
					if (_this.modifier & MODIFIER.CAPSLOCK) factor /= 10;
				}
				if ( _this.zoom != ZOOM.NONE ) {
					if (_this.zoom & ZOOM.IN) _fovEnd -= 0.001 * factor;
					if (_this.zoom & ZOOM.OUT) _fovEnd += 0.001 * factor;
				}
			}
			else {
				factor = _this.zoomSpeed;
				if (_this.modifier != MODIFIER.NONE) {
					if (_this.modifier & MODIFIER.CAPSLOCK) factor /= 16;
				}
				// console.log('factopr', factor)

				if ( _this.zoom != ZOOM.NONE) {
					if (_this.zoom & ZOOM.IN) _zoomEnd += 0.001 * factor;
					if (_this.zoom & ZOOM.OUT) _zoomEnd -= 0.001 * factor;
				}
			}

			_this.zoomCamera();

		}

		if ( ! _this.noSpin ) {

			var factor = _this.spinSpeed;

			if (_this.modifier != MODIFIER.NONE) {
				if (_this.modifier & MODIFIER.SHIFT) factor /= 8;
				if (_this.modifier & MODIFIER.CAPSLOCK) factor /= 16;
			}

			if ( _this.spin != SPIN.NONE) {
				if (_this.spin & SPIN.LEFT) _spinEnd -= 0.001 * factor;
				if (_this.spin & SPIN.RIGHT) _spinEnd += 0.001 * factor;
			}

			_this.spinCamera();

		}

		if ( ! _this.noPan ) {

			_this.panCamera();

		}

		_this.object.position.addVectors( _this.target, _eye );

		_this.checkDistances();

		_this.object.lookAt( _this.target );

		if (_this.looksAt) {

			var asd = new THREE.Vector3();
			if (_this.looksAt.getPosition) {
				_this.looksAt.getPosition(asd);
				_this.object.lookAt( asd );
			}
			else {
				_this.object.lookAt( _this.looksAt.position );
			}

		}

		if ( lastPosition.distanceToSquared( _this.object.position ) > EPS ) {

			_this.dispatchEvent( changeEvent );

			lastPosition.copy( _this.object.position );

		}

	};

	this.reset = function () {

		_state = STATE.NONE;
		_prevState = STATE.NONE;

		_this.target.copy( _this.target0 );
		_this.object.position.copy( _this.position0 );
		_this.object.up.copy( _this.up0 );

		_eye.subVectors( _this.object.position, _this.target );

		_this.object.lookAt( _this.target );

		_this.dispatchEvent( changeEvent );

		lastPosition.copy( _this.object.position );

	};

	// listeners


	function blur() {

		_this.zoom = ZOOM.NONE;
		_this.spin = SPIN.NONE;
		_this.rotate = ROTATE.NONE;
		_this.modifier = MODIFIER.NONE;

	}

	function keydown( event ) {

		if ( _this.enabled === false ) return;

		// window.removeEventListener( 'keydown', keydown );
/*
			_movePrev.copy( _moveCurr );
			_moveCurr.x += 0.1;
			// _moveCurr.copy( getMouseOnCircle( event.pageX, event.pageY ) );
*/

		switch (event.keyCode) {
			case _this.keys[ 'zoom-in' ]: _this.zoom |= ZOOM.IN; break;
			case _this.keys[ 'zoom-out' ]: _this.zoom |= ZOOM.OUT; break;
			case _this.keys[ 'spin-left' ]: _this.spin |= SPIN.LEFT; break;
			case _this.keys[ 'spin-right' ]: _this.spin |= SPIN.RIGHT; break;
			case _this.keys[ 'rotate-up' ]: _this.rotate |= ROTATE.UP; break;
			case _this.keys[ 'rotate-down' ]: _this.rotate |= ROTATE.DOWN; break;
			case _this.keys[ 'rotate-left' ]: _this.rotate |= ROTATE.LEFT; break;
			case _this.keys[ 'rotate-right' ]: _this.rotate |= ROTATE.RIGHT; break;
			case _this.keys[ 'modifier-alt' ]: _this.modifier |= MODIFIER.ALT; break;
			case _this.keys[ 'modifier-ctrl' ]: _this.modifier |= MODIFIER.CTRL; break;
			case _this.keys[ 'modifier-shift' ]: _this.modifier |= MODIFIER.SHIFT; break;
			// case _this.keys[ 'modifier-capslock' ]: _this.modifier |= MODIFIER.CAPSLOCK; break;
		}

		// ToDo: check if support is broad enough
		if (event.getModifierState("CapsLock")) {
			_this.modifier |= MODIFIER.CAPSLOCK
		}
		

		// console.log("=== ", event.keyCode, _this.rotate);

		_prevState = _state;

		if ( _state !== STATE.NONE ) {

			return;

		} else if ( event.keyCode === _this.keys[ 'lock-rotate' ] && ! _this.noRotate ) {

			_state = STATE.ROTATE;

		} else if ( event.keyCode === _this.keys[ 'lock-zoom' ] && ! _this.noZoom ) {

			_state = STATE.ZOOM;

		} else if ( event.keyCode === _this.keys[ 'lock-pan' ] && ! _this.noPan ) {

			_state = STATE.PAN;

		}

	}

	function keyup( event ) {

		if ( _this.enabled === false ) return;

		switch (event.keyCode) {
			case _this.keys[ 'zoom-in' ]: _this.zoom &= ~ZOOM.IN; break;
			case _this.keys[ 'zoom-out' ]: _this.zoom &= ~ZOOM.OUT; break;
			case _this.keys[ 'spin-left' ]: _this.spin &= ~SPIN.LEFT; break;
			case _this.keys[ 'spin-right' ]: _this.spin &= ~SPIN.RIGHT; break;
			case _this.keys[ 'rotate-up' ]: _this.rotate &= ~ROTATE.UP; break;
			case _this.keys[ 'rotate-down' ]: _this.rotate &= ~ROTATE.DOWN; break;
			case _this.keys[ 'rotate-left' ]: _this.rotate &= ~ROTATE.LEFT; break;
			case _this.keys[ 'rotate-right' ]: _this.rotate &= ~ROTATE.RIGHT; break;
			case _this.keys[ 'modifier-alt' ]: _this.modifier &= ~MODIFIER.ALT; break;
			case _this.keys[ 'modifier-ctrl' ]: _this.modifier &= ~MODIFIER.CTRL; break;
			case _this.keys[ 'modifier-shift' ]: _this.modifier &= ~MODIFIER.SHIFT; break;
			// case _this.keys[ 'modifier-capslock' ]: _this.modifier &= ~MODIFIER.CAPSLOCK; break;
		}

		// ToDo: check if support is broad enough
		if (event.getModifierState("CapsLock")) {
			_this.modifier |= MODIFIER.CAPSLOCK
		}
		else {
			_this.modifier &= ~MODIFIER.CAPSLOCK
		}

		// window.addEventListener( 'keydown', keydown, false );
		if ( _state !== STATE.NONE ) {

			return;

		} else if ( event.keyCode === _this.keys[ 'lock-rotate' ] && ! _this.noRotate ) {

			_state = _prevState;

		} else if ( event.keyCode === _this.keys[ 'lock-zoom' ] && ! _this.noZoom ) {

			_state = _prevState;

		} else if ( event.keyCode === _this.keys[ 'lock-pan' ] && ! _this.noPan ) {

			_state = _prevState;

		}

	}

	function mousedown( event ) {

		if ( _this.enabled === false ) return;

		event.preventDefault();
		// event.stopPropagation();

		if ( _state === STATE.NONE ) {

			_state = event.button;

		}

		if ( _state === STATE.ROTATE && ! _this.noRotate ) {

			_moveCurr.copy( getMouseOnCircle( event.pageX, event.pageY ) );
			_movePrev.copy( _moveCurr );

		} else if ( _state === STATE.ZOOM && ! _this.noZoom ) {

			_zoomStart = getMouseOnScreen( event.pageX, event.pageY ).y;
			_zoomEnd = _zoomStart;

		} else if ( _state === STATE.PAN && ! _this.noPan ) {

			_panStart.copy( getMouseOnScreen( event.pageX, event.pageY ) );
			_panEnd.copy( _panStart );

		}

		document.addEventListener( 'mousemove', mousemove, false );
		document.addEventListener( 'mouseup', mouseup, false );

		_this.dispatchEvent( startEvent );

	}

	function mousemove( event ) {

		if ( _this.enabled === false ) return;

		event.preventDefault();
		// event.stopPropagation();

		if ( _state === STATE.ROTATE && ! _this.noRotate ) {

			_movePrev.copy( _moveCurr );
			_moveCurr.copy( getMouseOnCircle( event.pageX, event.pageY ) );

		} else if ( _state === STATE.ZOOM && ! _this.noZoom ) {

			_zoomEnd.copy( getMouseOnScreen( event.pageX, event.pageY ) );

		} else if ( _state === STATE.PAN && ! _this.noPan ) {

			_panEnd.copy( getMouseOnScreen( event.pageX, event.pageY ) );

		}

	}

	function mouseup( event ) {

		if ( _this.enabled === false ) return;

		event.preventDefault();
		// event.stopPropagation();

		_state = STATE.NONE;

		document.removeEventListener( 'mousemove', mousemove );
		document.removeEventListener( 'mouseup', mouseup );
		_this.dispatchEvent( endEvent );

	}

	function mousewheel( event ) {

		if ( _this.enabled === false ) return;

		if ( _this.noZoom === true ) return;

		event.preventDefault();
		event.stopPropagation();

		// undefined, 0, assume pixels
		var factor = 0.00025;

		switch ( event.deltaMode ) {

			case 2:
				// Zoom in pages
				factor = 0.025;
				break;

			case 1:
				// Zoom in lines
				factor = 0.01;
				break;

		}

		// ctrl+scroll is mostly reserved for zooming
		if (_this.modifier & MODIFIER.ALT) factor /= 4;
		if (_this.modifier & MODIFIER.CTRL) factor /= 4;
		if (_this.modifier & MODIFIER.CAPSLOCK) factor /= 8;

		if (_this.modifier & MODIFIER.SHIFT) {
			_fovStart -= event.deltaY * factor;
		}
		else {
			_zoomStart -= event.deltaY * factor;
		}

		_this.dispatchEvent( startEvent );
		_this.dispatchEvent( endEvent );

	}

	function touchstart( event ) {

		if ( _this.enabled === false ) return;
		
		event.preventDefault();

		switch ( event.touches.length ) {

			case 1:
				_state = STATE.TOUCH_ROTATE;
				_moveCurr.copy( getMouseOnCircle( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY ) );
				_movePrev.copy( _moveCurr );
				break;

			default: // 2 or more
				_state = STATE.TOUCH_ZOOM_PAN;
				var dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
				var dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;
				_touchZoomDistanceEnd = _touchZoomDistanceStart = Math.sqrt( dx * dx + dy * dy );

				var x = ( event.touches[ 0 ].pageX + event.touches[ 1 ].pageX ) / 2;
				var y = ( event.touches[ 0 ].pageY + event.touches[ 1 ].pageY ) / 2;
				_panStart.copy( getMouseOnScreen( x, y ) );
				_panEnd.copy( _panStart );
				break;

		}

		_this.dispatchEvent( startEvent );

	}

	function touchmove( event ) {

		if ( _this.enabled === false ) return;

		event.preventDefault();
		event.stopPropagation();

		switch ( event.touches.length ) {

			case 1:
				_movePrev.copy( _moveCurr );
				_moveCurr.copy( getMouseOnCircle( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY ) );
				break;

			default: // 2 or more
				var dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
				var dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;
				_touchZoomDistanceEnd = Math.sqrt( dx * dx + dy * dy );

				var x = ( event.touches[ 0 ].pageX + event.touches[ 1 ].pageX ) / 2;
				var y = ( event.touches[ 0 ].pageY + event.touches[ 1 ].pageY ) / 2;
				_panEnd.copy( getMouseOnScreen( x, y ) );
				break;

		}

	}

	function touchend( event ) {

		if ( _this.enabled === false ) return;

		switch ( event.touches.length ) {

			case 0:
				_state = STATE.NONE;
				break;

			case 1:
				_state = STATE.TOUCH_ROTATE;
				_moveCurr.copy( getMouseOnCircle( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY ) );
				_movePrev.copy( _moveCurr );
				break;

		}

		_this.dispatchEvent( endEvent );

	}

	function contextmenu( event ) {

		if ( _this.enabled === false ) return;

		event.preventDefault();

	}

	this.dispose = function () {

		this.domElement.removeEventListener( 'contextmenu', contextmenu, false );
		this.domElement.removeEventListener( 'mousedown', mousedown, false );
		this.domElement.removeEventListener( 'wheel', mousewheel, false );

		this.domElement.removeEventListener( 'touchstart', touchstart, false );
		this.domElement.removeEventListener( 'touchend', touchend, false );
		this.domElement.removeEventListener( 'touchmove', touchmove, false );

		document.removeEventListener( 'mousemove', mousemove, false );
		document.removeEventListener( 'mouseup', mouseup, false );

		window.removeEventListener( 'keydown', keydown, false );
		window.removeEventListener( 'keyup', keyup, false );

	};

	this.domElement.addEventListener( 'contextmenu', contextmenu, false );
	this.domElement.addEventListener( 'mousedown', mousedown, false );
	this.domElement.addEventListener( 'wheel', mousewheel, false );

	this.domElement.addEventListener( 'touchstart', touchstart, false );
	this.domElement.addEventListener( 'touchend', touchend, false );
	this.domElement.addEventListener( 'touchmove', touchmove, false );

	window.addEventListener( 'keydown', keydown, false );
	window.addEventListener( 'keyup', keyup, false );
	window.addEventListener( 'blur', blur, false );

	this.handleResize();

	// force an update at start
	this.update();

};

THREE.TrackballControls.prototype = Object.create( THREE.EventDispatcher.prototype );
THREE.TrackballControls.prototype.constructor = THREE.TrackballControls;
