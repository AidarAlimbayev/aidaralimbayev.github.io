var gl;

//============================================================================
// Projection and modelview related data structures and functions
//============================================================================
// Projection transformation parameters
var	theFovy = 45.0;  		// Field-of-view in Y direction angle (in degrees)
var theAspect = 1.0;       // Viewport aspect ratio
var theZNear = 0.1;
var theZFar = 1000.0;

// Rotation parameters
var theAngle = 0.0;
var theAxis = [];

var theTrackingMove = false;
var theScalingMove = false;
var thePanMove = false;

var	theLastPos = [];
var	theCurtX, theCurtY;
var	theStartX, theStartY;
var	theCurtQuat = [1, 0, 0, 0];
var	theScale = 1.0;
var thePanX = 0.0;
var thePanY = 0.0;
var theInit = true;

// set to true when restarting the simulation
var restarting = false;
var rendering = false;

//Rotation related functions
function trackball_ptov(x, y,  v)
{
    var d, a;

	/* project x,y onto a hemisphere centered within width, height, note z is up here*/
    v[0] = x;
    v[1] = y;
    d = v[0] * v[0] + v[1] * v[1];
	if (d > 1) {
		v[2] = 0.0;
	} else {
		v[2] = Math.sqrt(1.0 - d);
	}

	a = 1.0 / Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
    v[0] *= a;
	v[1] *= a;
	v[2] *= a;
}

function trackball_vtoq(angle, axis)
{
	var c = Math.cos(angle/2.0);
	var s = Math.sin(angle/2.0);
	var a = 1.0 / Math.sqrt(axis[0]*axis[0] + axis[1]*axis[1] + axis[2]*axis[2]);

	var quat = [];

	quat[0] = c;
	quat[1] = axis[0] * a * s;
	quat[2] = axis[1] * a * s;
	quat[3] = axis[2] * a * s;

	return quat;
}

function multiplyQuat(a, b)
{
	var quat = [];

	quat[0] = a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3];
	quat[1] = a[0] * b[1] + b[0] * a[1] + a[2] * b[3] - b[2] * a[3];
	quat[2] = a[0] * b[2] - a[1] * b[3] + b[0] * a[2] + b[1] * a[3];
	quat[3] = a[0] * b[3] + a[1] * b[2] - b[1] * a[2] + b[0] * a[3];

	return quat;
}

function inverseQuat(q)
{
    var quat = vec4(q[0], -q[1], -q[2], -q[3]);
    var qNorm_sqr =q[0]*q[0] + q[1]*q[1] + q[2]*q[2] + q[3]*q[3];
    quat = vec4(quat[0] / qNorm_sqr, quat[1] / qNorm_sqr, quat[2] / qNorm_sqr, quat[3] / qNorm_sqr);
    return quat;
}

function buildRotationMatrix(q)
{
	var m = mat4(1-2*q[2]*q[2]-2*q[3]*q[3], 2*q[1]*q[2]+2*q[0]*q[3],   2*q[1]*q[3]-2*q[0]*q[2],   0,
				2*q[1]*q[2]-2*q[0]*q[3],   1-2*q[1]*q[1]-2*q[3]*q[3], 2*q[2]*q[3]+2*q[0]*q[1],   0,
				2*q[1]*q[3]+2*q[0]*q[2],   2*q[2]*q[3]-2*q[0]*q[1],   1-2*q[1]*q[1]-2*q[2]*q[2], 0,
				0,                         0,                         0,                         1);

   m = transpose(m);

   return m;
}

function getMousePos(e, canvas)
{
	var event = e || window.event;
	var client_x_r = event.clientX - canvas.offsetLeft;
	var client_y_r = event.clientY - canvas.offsetTop;
	var clip_x = -1 + 2 * client_x_r / canvas.width;
	var clip_y = -1 + 2 * (canvas.height - client_y_r) / canvas.height;
	var t = vec2(clip_x, clip_y);

	return t;
}

function startMotion(x, y)
{
	theTrackingMove = true;
	theStartX = x;
	theStartY = y;
	theCurtX = x;
	theCurtY = y;
	trackball_ptov(x, y, theLastPos);
}


function stopMotion(x, y)
{
    theTrackingMove = false;

	/* check if position has changed */
    if (theStartX == x && theStartY == y) {
	     theAngle = 0.0;
    }
}

function startScale(x, y)
{
	theScalingMove = true;
	theCurtX = x;
	theCurtY = y;
}

function stopScale(x, y)
{
    theScalingMove = false;
}

function startPan(x, y) {
    thePanMove = true;
    theCurtX = x;
    theCurtY = y;
}

function stopPan(x, y) {
    thePanMove = false;
}

//============================================================================
// Sphere related data structures and functions
//============================================================================
var theSphereVBOPoints, theSphereVBOCenters, theInitialSphereVBOPoints, theInitialSphereVBOCenters, theBodyRadiiVBO, isPlanetVBO;
var theSphereProgram;
var projectionMatrixLoc, sphereModelViewLoc, rotationLoc;
var theSpherePoints = [];
var theSphereCenters = [];
var theInitialSpherePoints = [];
var theInitialSphereCenters = [];
var theBodyRadii = [];
var isPlanetArray = [];

var theSphereVertices = [];
var theInitialSphereVertices = [];

// lighting and shading
var lightPosition = vec4(2.0, 2.0, 2.0, 1.0 );
var ambientProduct = 0.5;
var diffuseProduct = 0.5;
var specularProduct = 0.75;
var shininess = 35;

function sphereQuad(a, b, c, d, center, radius)
{
    theSpherePoints.push(theSphereVertices[a]);
    theSpherePoints.push(theSphereVertices[b]);
    theSpherePoints.push(theSphereVertices[c]);
    theSpherePoints.push(theSphereVertices[a]);
    theSpherePoints.push(theSphereVertices[c]);
    theSpherePoints.push(theSphereVertices[d]);

    // ADD CENTERS
    theSphereCenters.push(center);
    theSphereCenters.push(center);
    theSphereCenters.push(center);
    theSphereCenters.push(center);
    theSphereCenters.push(center);
    theSphereCenters.push(center);

    // ADD RADII
    theBodyRadii.push(radius);
    theBodyRadii.push(radius);
    theBodyRadii.push(radius);
    theBodyRadii.push(radius);
    theBodyRadii.push(radius);
    theBodyRadii.push(radius);
}

function initSphereQuad(a, b, c, d, center, isPlanet)
{
    theInitialSpherePoints.push(theInitialSphereVertices[a]);
    theInitialSpherePoints.push(theInitialSphereVertices[b]);
    theInitialSpherePoints.push(theInitialSphereVertices[c]);
    theInitialSpherePoints.push(theInitialSphereVertices[a]);
    theInitialSpherePoints.push(theInitialSphereVertices[c]);
    theInitialSpherePoints.push(theInitialSphereVertices[d]);

    // ADD CENTERS
    theInitialSphereCenters.push(center);
    theInitialSphereCenters.push(center);
    theInitialSphereCenters.push(center);
    theInitialSphereCenters.push(center);
    theInitialSphereCenters.push(center);
    theInitialSphereCenters.push(center);

    var planet = isPlanet ? 1.01 : 0.01;
    // add isPlanet bools
    isPlanetArray.push(planet);
    isPlanetArray.push(planet);
    isPlanetArray.push(planet);
    isPlanetArray.push(planet);
    isPlanetArray.push(planet);
    isPlanetArray.push(planet);

}

function initSphere()
{
    //  Load shaders and initialize attribute buffers
    theSphereProgram = initShaders(gl, "sphere-vertex-shader", "sphere-fragment-shader");
    gl.useProgram(theSphereProgram);

    // Create VBOs and load the data into the VBOs
    theSphereVBOPoints = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, theSphereVBOPoints);
    gl.bufferData(gl.ARRAY_BUFFER, MAX_BODIES*6*4*4, gl.DYNAMIC_DRAW);

    theSphereVBOCenters = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, theSphereVBOCenters);
    gl.bufferData(gl.ARRAY_BUFFER, MAX_BODIES*6*3*4, gl.DYNAMIC_DRAW);

    theInitialSphereVBOPoints = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, theInitialSphereVBOPoints);
    gl.bufferData(gl.ARRAY_BUFFER, MAX_BODIES*6*4*4, gl.DYNAMIC_DRAW);

    theInitialSphereVBOCenters = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, theInitialSphereVBOCenters);
    gl.bufferData(gl.ARRAY_BUFFER, MAX_BODIES*6*3*4, gl.DYNAMIC_DRAW);

    theBodyRadiiVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, theBodyRadiiVBO);
    gl.bufferData(gl.ARRAY_BUFFER, MAX_BODIES*6*1*4, gl.DYNAMIC_DRAW);

    isPlanetVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, isPlanetVBO);
    gl.bufferData(gl.ARRAY_BUFFER, MAX_BODIES*6*1*4, gl.DYNAMIC_DRAW);

    gl.uniform1f( gl.getUniformLocation(theSphereProgram,
       "ambientProduct"),(ambientProduct) );
    gl.uniform1f( gl.getUniformLocation(theSphereProgram,
       "diffuseProduct"),(diffuseProduct) );
    gl.uniform1f( gl.getUniformLocation(theSphereProgram,
       "specularProduct"),(specularProduct) );
    gl.uniform4fv( gl.getUniformLocation(theSphereProgram,
       "lightPosition"),flatten(lightPosition) );
    gl.uniform1f( gl.getUniformLocation(theSphereProgram,
       "shininess"),shininess );

    projectionMatrixLoc = gl.getUniformLocation(theSphereProgram, "projectionMatrix");
    sphereModelViewLoc = gl.getUniformLocation(theSphereProgram, "sphereModelViewMatrix");
    rotationLoc = gl.getUniformLocation(theSphereProgram, "rotationMatrix");

}

function drawSphere(p, sphereMv, rotMat, mv)
{
    gl.uniformMatrix4fv( projectionMatrixLoc,	false, flatten(p));

    gl.uniformMatrix4fv( sphereModelViewLoc, 	false, flatten(sphereMv));

    // actually the inverse rotation matrix
    gl.uniformMatrix4fv( rotationLoc,  false, flatten(rotMat));

    // Associate our shader variables with our data buffer
    var vPosition = gl.getAttribLocation(theSphereProgram, "vPosition");
    gl.bindBuffer(gl.ARRAY_BUFFER, theSphereVBOPoints);
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    var vCenter = gl.getAttribLocation(theSphereProgram, "vCenter");
    gl.bindBuffer(gl.ARRAY_BUFFER, theSphereVBOCenters);
    gl.vertexAttribPointer(vCenter, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vCenter);

    var vInitPosition = gl.getAttribLocation(theSphereProgram, "vInitPosition");
    gl.bindBuffer(gl.ARRAY_BUFFER, theInitialSphereVBOPoints);
    gl.vertexAttribPointer(vInitPosition, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vInitPosition);

    var vInitCenter = gl.getAttribLocation(theSphereProgram, "vInitCenter");
    gl.bindBuffer(gl.ARRAY_BUFFER, theInitialSphereVBOCenters);
    gl.vertexAttribPointer(vInitCenter, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vInitCenter);

    var vBodyRadius = gl.getAttribLocation(theSphereProgram, "vBodyRadius");
    gl.bindBuffer(gl.ARRAY_BUFFER, theBodyRadiiVBO);
    gl.vertexAttribPointer(vBodyRadius, 1, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vBodyRadius);

    var vIsPlanet = gl.getAttribLocation(theSphereProgram, "vIsPlanet");
    gl.bindBuffer(gl.ARRAY_BUFFER, isPlanetVBO);
    gl.vertexAttribPointer(vIsPlanet, 1, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vIsPlanet);

    gl.drawArrays( gl.TRIANGLES, 0, bodies.length*6);
}

// initializes the textures for the sphere
function initSphereTextures(earthCube, sunCube) {
    //create the earth texture
    var earthCubeMap = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, earthCubeMap);

    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, earthCube.pos_x);
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, earthCube.neg_x);
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, earthCube.pos_y);
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, earthCube.neg_y);
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, earthCube.pos_z);
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, earthCube.neg_z);

    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

    //create the sun texture
    var sunCubeMap = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, sunCubeMap);

    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, sunCube.pos_x);
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, sunCube.neg_x);
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, sunCube.pos_y);
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, sunCube.neg_y);
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, sunCube.pos_z);
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, sunCube.neg_z);

    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

    //link to shaders
    gl.uniform1i(gl.getUniformLocation(theSphereProgram, "earthTexMap"),0);
    gl.uniform1i(gl.getUniformLocation(theSphereProgram, "sunTexMap"),1);

}

/**
* Using the list of bodies, creates quad spheres for each and pushes
* the necessary data to the VBOs.
* rQuat is the rotation quaternion
*/
function createBodySpheres(rQuat) {
    // clear old points
    theSpherePoints = [];
    theSphereCenters = [];
    theInitialSpherePoints = [];
    theInitialSphereCenters = [];
    theBodyRadii = [];
    isPlanetArray = [];

    var vertData = [];

    for (var i = 0; i < bodies.length; i++) {
        var body = bodies[i];
        // calculate scaled sphere radius
        var radius;
        var isPlanet = body.isPlanet;
        if (isPlanet) {
            radius = getPlanetRadius(body);
        } else {
            radius = getStarRadius(body);
        }

        // translate position to gl coords
        var curPos = body.position;
        var initX = (curPos[0] / SYSTEM_RADIUS) * 100.0;
        var initY = (curPos[1] / SYSTEM_RADIUS) * 100.0;
        var initZ = (curPos[2] / SYSTEM_RADIUS) * 100.0;

        var initCenter = vec3(initX, initY, initZ);
        // calculate initial vertices from body position
        theInitialSphereVertices = [
            vec4(initCenter[0] - radius, initCenter[1] + radius, initCenter[2], 1.0),
            vec4(initCenter[0] + radius, initCenter[1] + radius, initCenter[2], 1.0),
            vec4(initCenter[0] + radius, initCenter[1] - radius, initCenter[2], 1.0),
            vec4(initCenter[0] - radius, initCenter[1] - radius, initCenter[2], 1.0)
        ];

        // calculate rotated vertices
        var invQuat = inverseQuat(rQuat);
        var rotCenter = multiplyQuat(rQuat, multiplyQuat(vec4(0, initCenter), invQuat));
        currentSphereCenter = vec3(rotCenter[1], rotCenter[2], rotCenter[3]);
        theSphereVertices = [
            vec4(currentSphereCenter[0] - radius, currentSphereCenter[1] + radius, currentSphereCenter[2], 1.0),
            vec4(currentSphereCenter[0] + radius, currentSphereCenter[1] + radius, currentSphereCenter[2], 1.0),
            vec4(currentSphereCenter[0] + radius, currentSphereCenter[1] - radius, currentSphereCenter[2], 1.0),
            vec4(currentSphereCenter[0] - radius, currentSphereCenter[1] - radius, currentSphereCenter[2], 1.0)
        ];

        //push to array to be sorted
        var data = {
            initialCenter : initCenter,
            initialVerts : theInitialSphereVertices,
            currentCenter : currentSphereCenter,
            currentVerts : theSphereVertices,
            visualRadius : radius,
            bodyIsPlanet : isPlanet,
            z : currentSphereCenter[2]
        };

        vertData.push(data);

    }

    // sort from -z to +z for blending
    vertData.sort(blendingCompare);

    // now create quads
    for (var i = 0; i < vertData.length; i++) {
        var curDat = vertData[i];
        theInitialSphereVertices = curDat.initialVerts;
        theSphereVertices = curDat.currentVerts;
        // create intial sphere quad
        initSphereQuad(0, 1, 2, 3, curDat.initialCenter, curDat.bodyIsPlanet);
        // create sphere quad that will be viewed
        sphereQuad(0, 1, 2, 3, curDat.currentCenter, curDat.visualRadius);
    }

    // update the VBOs
    updateVBOs();
}

/**
* Comparator to sort -z to +z for blending
* return < 0 : a.z < b.z
* return == 0 : same z
* return > 0 : a.z > b.z
*/
function blendingCompare(a, b) {
    if (a.z < b.z) {
        return -1;
    } else if (a.z == b.z) {
        return 0;
    } else {
        return 1;
    }
}

/**
* pushes all necessary data into buffers
*/
function updateVBOs() {
    // update buffer data
    gl.bindBuffer(gl.ARRAY_BUFFER, theSphereVBOPoints);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, flatten(theSpherePoints));

    gl.bindBuffer(gl.ARRAY_BUFFER, theSphereVBOCenters);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, flatten(theSphereCenters));

    gl.bindBuffer(gl.ARRAY_BUFFER, theInitialSphereVBOPoints);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, flatten(theInitialSpherePoints));

    gl.bindBuffer(gl.ARRAY_BUFFER, theInitialSphereVBOCenters);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, flatten(theInitialSphereCenters));

    gl.bindBuffer(gl.ARRAY_BUFFER, theBodyRadiiVBO);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, flatten(theBodyRadii));

    gl.bindBuffer(gl.ARRAY_BUFFER, isPlanetVBO);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, flatten(isPlanetArray));
}

/**
* calculates the visual radius of a planet based on its mass
* max is 0.5
*/
function getPlanetRadius(planet) {
    return (planet.mass / maxPlanetMass)*0.25 + 0.25;
}

/**
* calculates the visual radius of a star based on its mass
* max is 2.0
*/
function getStarRadius(star) {
    return (star.mass / maxStarMass)*1.5 + 0.5;
}


//===========================================================================
// Physics Related functions
//===========================================================================
// constants
var EARTH_MASS = 5.97219e24; //kg
var SOLAR_MASS = 1.98855e30; //kg
var GRAV_CONST = 6.674e-11; //N*m^2/kg^2
var MAX_BODIES = 500;
var SYSTEM_DIAMETER = 8.496e12 //m
var SYSTEM_RADIUS = SYSTEM_DIAMETER / 2; //m
var MAX_INCLINE = 4.394e10; // m
var TIME_STEP = 86400; //s = 1 day
var SOFTENING_LENGTH = 3e10; // m
// params set by user
var numStars = 10;
var numPlanets = 100;
var minStarMass = SOLAR_MASS; // solar mass (small star)
var maxStarMass = SOLAR_MASS * 10; // 10 solar masses  (massive star)
var minPlanetMass = EARTH_MASS * 0.0025; // about Pluto
var maxPlanetMass = EARTH_MASS * 320; // about Jupiter
var minStarVel = 0; // m/s
var maxStarVel = 1000; // m/s
var minPlanetVel = 0; // m/s
var maxPlanetVel = 50000; // m/s

// params seen by user, set to defaults originally
var numStars_ui = numStars;
var numPlanets_ui = numPlanets;
var minStarMass_solarUnits = minStarMass / SOLAR_MASS;
var maxStarMass_solarUnits = maxStarMass / SOLAR_MASS;
var minPlanetMass_earthUnits = minPlanetMass / EARTH_MASS;
var maxPlanetMass_earthUnits = maxPlanetMass / EARTH_MASS;
var minStarVel_km = minStarVel / 1000;
var maxStarVel_km = maxStarVel / 1000;
var minPlanetVel_km = minPlanetVel / 1000;
var maxPlanetVel_km = maxPlanetVel / 1000;

var timePassed = 0.0; // in years
// all bodies currently in system
var bodies = [];
var numBodies = 0;

/**
* initializes the system
*/
function initSimulation(initGui) {
    if (initGui) {
        // set up menu for parameters
        var gui = new dat.GUI({autoplace : true, width : 415});

        gui.add(this, 'timePassed').name('Time Passed (years)').step(0.1).listen();
        gui.add(this, 'numBodies').name('Current Bodies').listen();
        gui.add(this, 'fps').name('FPS').listen();
        gui.add({f:this.restartSim}, 'f').name('Restart Simulation');
        gui.add(this, 'paused').name('Pause Simulation').listen();
        gui.add({f:this.setDefaultValues}, 'f').name('Default Parameters');
        gui.add({f:this.setDefaultView}, 'f').name('Default View');

        var f1 = gui.addFolder('Star Parameters');
        f1.add(this, 'numStars_ui', 0, MAX_BODIES / 2.0).name('Number of Stars').step(1).listen();
        f1.add(this, 'minStarMass_solarUnits', 0, 25).name('Min Mass (Solar Mass Units)').listen();
        f1.add(this, 'maxStarMass_solarUnits', 0, 25).name('Max Mass (Solar Mass Units)').listen();
        f1.add(this, 'minStarVel_km', 0, 100).name('Min Velocity (km/s)').listen();
        f1.add(this, 'maxStarVel_km', 0, 100).name('Max Velocity (km/s)').listen();
        f1.open();

        var f2 = gui.addFolder('Planet Parameters');
        f2.add(this, 'numPlanets_ui', 0, MAX_BODIES / 2.0).name('Number of Planets').step(1).listen();
        f2.add(this, 'minPlanetMass_earthUnits', 0, 500).name('Min Mass (Earth Mass Units)').listen();
        f2.add(this, 'maxPlanetMass_earthUnits', 0, 500).name('Max Mass (Earth Mass Units)').listen();
        f2.add(this, 'minPlanetVel_km', 0, 100).name('Min Velocity (km/s)').listen();
        f2.add(this, 'maxPlanetVel_km', 0, 100).name('Max Velocity (km/s)').listen();
        f2.open();
    }

    // create specified bodies
    addStars(numStars);
    addPlanets(numPlanets);
}

/**
* restart the simulation using new values
*/
function restartSim() {
    restarting = true;
    while(rendering) {
        // do nothing, wait until done
    }
    // clear bodies
    bodies = [];
    numBodes = 0;
    timePassed = 0;
    fetchUserParams();
    initSimulation(false);
    restarting = false;
}

function setDefaultValues() {
    // params set by user
    numStars = 10;
    numPlanets = 100;
    minStarMass = SOLAR_MASS; // solar mass (small star)
    maxStarMass = SOLAR_MASS * 10; // 10 solar masses  (massive star)
    minPlanetMass = EARTH_MASS * 0.0025; // about Pluto
    maxPlanetMass = EARTH_MASS * 320; // about Jupiter
    minStarVel = 0; // m/s
    maxStarVel = 1000; // m/s
    minPlanetVel = 0; // m/s
    maxPlanetVel = 50000; // m/s

    // params seen by user
    numStars_ui = numStars;
    numPlanets_ui = numPlanets;
    minStarMass_solarUnits = minStarMass / SOLAR_MASS;
    maxStarMass_solarUnits = maxStarMass / SOLAR_MASS;
    minPlanetMass_earthUnits = minPlanetMass / EARTH_MASS;
    maxPlanetMass_earthUnits = maxPlanetMass / EARTH_MASS;
    minStarVel_km = minStarVel / 1000;
    maxStarVel_km = maxStarVel / 1000;
    minPlanetVel_km = minPlanetVel / 1000;
    maxPlanetVel_km = maxPlanetVel / 1000;
}

/**
* Sets the parameters for the simulation to what's currently in the user values
*/
function fetchUserParams() {
    numStars = numStars_ui;
    numPlanets = numPlanets_ui;
    minStarMass = minStarMass_solarUnits * SOLAR_MASS;
    maxStarMass = maxStarMass_solarUnits * SOLAR_MASS;
    minPlanetMass = minPlanetMass_earthUnits * EARTH_MASS;
    maxPlanetMass = maxPlanetMass_earthUnits * EARTH_MASS;
    minStarVel = minStarVel_km * 1000;
    maxStarVel = maxStarVel_km * 1000;
    minPlanetVel = minPlanetVel_km * 1000;
    maxPlanetVel = maxPlanetVel_km * 1000;
}

/*
* calculates the forces on each body and update position and velocity accordingly
*/
function updateBodies() {
    var collidingBodies = [];
    var collisionIndices = [];

    // for each body
    for (var i = 0; i < bodies.length; i++) {
        var curBody = bodies[i];
        // calculate the force on it
        var force = vec3(0.0, 0.0, 0.0);
        for (var j = 0; j < bodies.length; j++) {
            if (j != i) {
                var forceBody = bodies[j];
                if (areColliding(curBody, forceBody)) {
                    // add to collision list if not there already
                    var curInd = collisionIndices.indexOf(i);
                    var forceInd = collisionIndices.indexOf(j);
                    // make sure NEITHER body is already colliding with a different one, wait til next frame if it is
                    if (curInd == -1 && forceInd == -1) {
                        collidingBodies.push(vec2(curBody, forceBody));
                        collisionIndices.push(i);
                        collisionIndices.push(j);
                    }
                }

                var Gmm = GRAV_CONST*curBody.mass*forceBody.mass;
                var dist = subtract(forceBody.position, curBody.position);
                var denominator = Math.pow(length(dist)*length(dist) + SOFTENING_LENGTH*SOFTENING_LENGTH, 3.0/2.0);
                var scaleBy = Gmm / denominator;
                var forceFromJ = mult(dist, vec3(scaleBy, scaleBy, scaleBy));
                force = add(force, forceFromJ);
            }
        }

        // calculate acceleration from force
        var curMass = curBody.mass;
        var acceleration = mult(force, vec3(1.0 / curMass, 1.0 / curMass, 1.0 / curMass));

        // update velocity and position
        var curVel = curBody.velocity;
        var newVel = add(curVel, mult(acceleration, vec3(TIME_STEP, TIME_STEP, TIME_STEP)));
        curBody.velocity = newVel;
        var curPos = curBody.position;
        var newPos = add(curPos, mult(newVel, vec3(TIME_STEP, TIME_STEP, TIME_STEP)));
        curBody.position = newPos;
    }

    // resolve collisions and push new bodies[]
    var updatedBodies = [];
    for (var i = 0; i < collidingBodies.length; i++) {
        var pair = collidingBodies[i];
        var newBody = resolveCollision(pair[0], pair[1]);
        updatedBodies.push(newBody);
    }

    // now push bodies that didn't collide
    for (var i = 0; i < bodies.length; i++) {
        var curBody = bodies[i];
        if (collisionIndices.indexOf(i) == -1) {
            updatedBodies.push(curBody);
        }
    }

    // update bodies array
    bodies = updatedBodies;
    numBodies = bodies.length;

    timePassed += TIME_STEP/60.0/60.0/24.0/365.0;
}

/**
* Determines whether 2 bodies are colliding
*/
function areColliding(body1, body2) {
    var dist = length(subtract(body1.position, body2.position));
    if (dist < SOFTENING_LENGTH) {
        return true;
    } else {
        return false;
    }
}

/**
* Resolves a collision between two bodies by combining them into a single one.
* The new body is placed at the position of the body with larger mass.
*/
function resolveCollision(body1, body2) {
    var newPosition = body1.mass >= body2.mass ? body1.position : body2.position;
    // sum the masses
    var newMass = body1.mass + body2.mass;

    // inelastic collision to calculate new velocity (assume stick together) =
    // (mass1 / newMass) * v1 + (mass2 / newMass) * v2
    var mass1Ratio = (body1.mass / newMass);
    var term1 = mult(body1.velocity, vec3(mass1Ratio, mass1Ratio, mass1Ratio));
    var mass2Ratio = (body2.mass / newMass);
    var term2 = mult(body2.velocity, vec3(mass2Ratio, mass2Ratio, mass2Ratio));
    var newVel = add(term1, term2);

    newBody = {
        mass : newMass,
        position : newPosition,
        velocity : newVel,
        isPlanet : (body1.isPlanet && body2.isPlanet)
    }

    return newBody;
}

/**
* Adds specified number of stars to the simulation
*/
function addStars(numToAdd) {
    for (var i = 0; i < numToAdd; i++) {
        // generate a mass between min and max
        var bodyMass = minStarMass + (Math.random() * (maxStarMass - minStarMass));
        //generate a position
        var bodyPosition = vec3(Math.random()*SYSTEM_DIAMETER - SYSTEM_RADIUS, Math.random()*SYSTEM_DIAMETER - SYSTEM_RADIUS, Math.random()*(MAX_INCLINE*2) - MAX_INCLINE);
        //generate a velocity
        var bodyVelocity = vec3(Math.random()*2*maxStarVel - maxStarVel, Math.random()*2*maxStarVel - maxStarVel, 0.0);
        //create body
        var body = {
            mass : bodyMass,
            position : bodyPosition,
            velocity : bodyVelocity,
            isPlanet : false
        }
        //push to system
        bodies.push(body);
    }
}

/**
* Adds specified number of planets to the simulation
*/
function addPlanets(numToAdd) {
    for (var i = 0; i < numToAdd; i++) {
        // generate a mass between min and max
        var bodyMass = minPlanetMass + (Math.random() * (maxPlanetMass - minPlanetMass));
        //generate a position
        var bodyPosition = vec3(Math.random()*SYSTEM_DIAMETER - SYSTEM_RADIUS, Math.random()*SYSTEM_DIAMETER - SYSTEM_RADIUS, Math.random()*(MAX_INCLINE*2) - MAX_INCLINE);
        //generate a velocity
        var bodyVelocity = vec3(Math.random()*2*maxPlanetVel - maxPlanetVel, Math.random()*2*maxPlanetVel - maxPlanetVel, 0.0);
        //create body
        var body = {
            mass : bodyMass,
            position : bodyPosition,
            velocity : bodyVelocity,
            isPlanet : true
        }
        //push to system
        bodies.push(body);
    }
}


//============================================================================
// WebGL Initialization
//============================================================================
var lastRefreshTime;
var fps = 0;
var paused = false;
window.onload = function init()
{
    var canvas = document.getElementById("gl-canvas");

    //set full page
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) {
        alert( "WebGL isn't available" );
    }

    //  Configure WebGL
    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor(0.0, 0.0, 0.0, 1.0 );
	theAspect = canvas.width * 1.0 / canvas.height;

    gl.enable(gl.DEPTH_TEST);
    // Enable blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);


    //initialize system
    initSimulation(true);

	initSphere();

    // load textures
    var earth_pos_y = document.getElementById("earth_pos_y");
    var earth_pos_x = document.getElementById("earth_pos_x");
    var earth_pos_z = document.getElementById("earth_pos_z");
    var earth_neg_y = document.getElementById("earth_neg_y");
    var earth_neg_x = document.getElementById("earth_neg_x");
    var earth_neg_z = document.getElementById("earth_neg_z");
    var earthCube = {
        pos_y : earth_pos_y,
        pos_x : earth_pos_x,
        pos_z : earth_pos_z,
        neg_y : earth_neg_y,
        neg_x : earth_neg_x,
        neg_z : earth_neg_z
    }

    var sun_pos_y = document.getElementById("sun_pos_y");
    var sun_pos_x = document.getElementById("sun_pos_x");
    var sun_pos_z = document.getElementById("sun_pos_z");
    var sun_neg_y = document.getElementById("sun_neg_y");
    var sun_neg_x = document.getElementById("sun_neg_x");
    var sun_neg_z = document.getElementById("sun_neg_z");
    var sunCube = {
        pos_y : sun_pos_y,
        pos_x : sun_pos_x,
        pos_z : sun_pos_z,
        neg_y : sun_neg_y,
        neg_x : sun_neg_x,
        neg_z : sun_neg_z
    }

    initSphereTextures(earthCube, sunCube);

    lastRefreshTime = new Date().getTime();
    render();

    canvas.addEventListener("mousedown", function(e){
 		var pos = getMousePos(e, this);
		var x = pos[0];
		var y = pos[1];

		if (e.button == 0) {
            if (!e.ctrlKey) {
			    startMotion(x, y);
            } else {
                startPan(x, y);
            }
		} else if (e.button == 1) {
			startScale(x, y);
		}

		//render();
    } );

    canvas.addEventListener("mousemove", function(e){
		var pos = getMousePos(e, this);
		var x = pos[0];
		var y = pos[1];

		var curPos = [];
		var dx, dy, dz;

		/* compute position on hemisphere */
		trackball_ptov(x, y, curPos);

		if(theTrackingMove)
		{
			/* compute the change in position
			on the hemisphere */
			dx = curPos[0] - theLastPos[0];
			dy = curPos[1] - theLastPos[1];
			dz = curPos[2] - theLastPos[2];
			if (dx || dy || dz)
			{
				/* compute theta and cross product */
				theAngle = 90.0 * Math.sqrt(dx*dx + dy*dy + dz*dz) / 180.0 * Math.PI;
				theAxis = cross(theLastPos, curPos);

				var q = trackball_vtoq(theAngle, theAxis);

				if (theInit) {
					theCurtQuat = q;
					theInit = false;
				} else {
					theCurtQuat = multiplyQuat(q, theCurtQuat);
				}

				/* update position */
				theLastPos[0] = curPos[0];
				theLastPos[1] = curPos[1];
				theLastPos[2] = curPos[2];
			}

			//render();
		}

		if (theScalingMove) {
			if (theCurtX != x || theCurtY != y) {

				theScale += (theCurtY * 1.0 - y)/2.0 * 1.3 * theScale; // 2.0 - the windows height
				if (theScale <= 0.0) {
					theScale = 0.00000001;
				}

				theCurtX = x;
				theCurtY = y;
			}

			//render();
		}

        if (thePanMove) {
            if (theCurtX != x || theCurtY != y) {
                var xDiff = x - theCurtX;
                var yDiff = y - theCurtY;

                thePanX += xDiff*100;
                thePanY += yDiff*100;
            }

            theCurtX = x;
            theCurtY = y;
        }

    });

    canvas.addEventListener("mouseup", function(e) {
		var pos = getMousePos(e, this);
		var x = pos[0];
		var y = pos[1];

		if (e.button == 0) {
			stopMotion(x, y);
            stopPan(x, y);
		} else if (e.button == 1) {
			stopScale(x, y);
		}
    });
};

function setDefaultView() {
    thePanX = 0;
    thePanY = 0;
    theScale = 1.0;
    theAngle = 0.0;
    theAxis = [];
    theCurtQuat = [1, 0, 0, 0];
}


//============================================================================
// Rendering function
//============================================================================
function render()
{
    if (!restarting) {
        rendering = true;
        gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        if (!paused) {
            // calculates the forces on each body and update position and velocity accordingly
            updateBodies();
        }

        //projection matrix
        var  p = perspective( theFovy, theAspect, theZNear, theZFar );

        //modelview matrix
        var t = translate(thePanX, thePanY, -250.0);
        var s = scale(theScale, theScale, theScale);
        var r = buildRotationMatrix(theCurtQuat);
        var mv = mat4();
        mv = mult(mv, t);
        mv = mult(mv, s);
        var sphereMv = mv; // only need trans, scale since already do rotation in update functs
        mv = mult(mv, r);

        // create spheres for each body and update VBOs
        createBodySpheres(theCurtQuat);

        // draw bodies
        drawSphere(p, sphereMv, buildRotationMatrix(inverseQuat(theCurtQuat)), mv); //must rotate tex opposite of quaternion rotation
        rendering = false;
    }
    // calculate fps
    var currTime = new Date().getTime();
    var timePassed = (currTime - lastRefreshTime) / 1000.0;
    fps = 1.0 / timePassed;
    //update time
    lastRefreshTime = currTime;
    requestAnimFrame(render);
}
