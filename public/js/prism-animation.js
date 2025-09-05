document.addEventListener('DOMContentLoaded', () => {
    const heroSection = document.querySelector('.hero');
    if (!heroSection) return;

    let scene, camera, renderer, animationGroup, pyramid, beam, spectrum, mouse, clock, pyramidEdges;
    let darkThemeMaterial, lightThemeMaterial, beamMaterial, spectrumMaterial, internalBeamMaterial;
    const pyramidRadius = 1.5;
    const introDuration = 2.5; // seconds
    const basePyramidRotation = { x: Math.atan(Math.sqrt(2)), y: -Math.PI / 4, z: 0 };

    function init() {
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(75, heroSection.offsetWidth / heroSection.offsetHeight, 0.1, 1000);
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setClearColor(0x000000, 0);
        renderer.setSize(heroSection.offsetWidth, heroSection.offsetHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        const canvas = renderer.domElement;
        canvas.id = 'hero-canvas';
        heroSection.appendChild(canvas);

        mouse = new THREE.Vector2();

        animationGroup = new THREE.Group();
        scene.add(animationGroup);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        directionalLight.position.set(-5, 3, 5);
        scene.add(directionalLight);

        // Materials & Environment Map
        const textureLoader = new THREE.TextureLoader();
        const envMapTexture = textureLoader.load('assets/share_background.jpg', () => {
            envMapTexture.mapping = THREE.EquirectangularReflectionMapping;
            scene.environment = envMapTexture;
        });

        darkThemeMaterial = new THREE.MeshPhysicalMaterial({
            metalness: 0,
            roughness: 0.0, // Even smoother
            transmission: 1.0,
            transparent: true,
            ior: 2.3, // Index of Refraction (diamond-like)
            clearcoat: 1.0,
            clearcoatRoughness: 0.0, // Shinier clear coat
            envMap: envMapTexture,
            envMapIntensity: 3.0 // Slightly reduced intensity
        });

        lightThemeMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x333333, // Dark "smoked glass" color
            metalness: 0.2,  // Low metalness for glass
            roughness: 0.02,  // Even smoother
            transmission: 0.85, // High transmission for transparency
            transparent: true,
            ior: 1.5, // Reverted IOR
            clearcoat: 1.0,
            clearcoatRoughness: 0.0, // Shinier clear coat
            envMap: envMapTexture,
            envMapIntensity: 3.8 // Slightly reduced intensity
        });

        const createPrismShaderCompiler = (intensity) => {
            return (shader) => {
                shader.uniforms.pulse = spectrumMaterial.uniforms.pulse;

                shader.vertexShader = 'varying vec3 vViewNormal;\n' + shader.vertexShader;
                shader.vertexShader = shader.vertexShader.replace(
                    '#include <begin_vertex>',
                    '#include <begin_vertex>\nvViewNormal = normalize(normalMatrix * normal);'
                );

                shader.fragmentShader = 'varying vec3 vViewNormal;\n' +
                                        'uniform float pulse;\n' +
                                        'vec3 hsv2rgb(vec3 c) { vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0); vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www); return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y); }\n' +
                                        shader.fragmentShader;

                shader.fragmentShader = shader.fragmentShader.replace(
                    '#include <dithering_fragment>',
                    `
                    #include <dithering_fragment>
                    // FAKE SPECTRUM REFLECTION
                    vec2 matcapUV = vViewNormal.xy * 0.5 + 0.5;
                    float hue;
                    if (matcapUV.y < 0.5) {
                        hue = mix(0.0, 0.166, smoothstep(0.0, 0.5, matcapUV.y));
                    } else {
                        hue = mix(0.166, 0.666, smoothstep(0.5, 1.0, matcapUV.y));
                    }
                    
                    float fresnel = pow(1.0 - abs(dot(vViewNormal, vec3(0,0,1))), 2.0);
                    float reflectionValue = fresnel * pulse * ${intensity.toFixed(2)};
                    vec3 reflectionColor = hsv2rgb(vec3(hue, 1.0, reflectionValue));

                    gl_FragColor.rgb += reflectionColor;
                    `
                );
            };
        };

        darkThemeMaterial.onBeforeCompile = createPrismShaderCompiler(2.5); // Higher intensity for dark theme
        lightThemeMaterial.onBeforeCompile = createPrismShaderCompiler(1.5); // Balanced intensity for light theme

        beamMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.85, // Increased opacity
            blending: THREE.AdditiveBlending, // Make it glow
            depthWrite: false
        });
        spectrumMaterial = new THREE.ShaderMaterial({
            uniforms: { time: { value: 0.0 }, pulse: { value: 1.0 }, isLightTheme: { value: 0.0 } },
            vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
            fragmentShader: `
                varying vec2 vUv;
                uniform float time;
                uniform float pulse;
                uniform float isLightTheme;
                vec3 hsv2rgb(vec3 c) { vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0); vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www); return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y); }
                void main() {
                    float y = vUv.y;
                    float hue;

                    // Define hues for Red, Yellow, Blue
                    float red_h = 0.0;
                    float yellow_h = 0.166;
                    float blue_h = 0.666;

                    // Blend from Red to Yellow in the first half, and Yellow to Blue in the second half
                    if (y < 0.5) {
                        hue = mix(red_h, yellow_h, smoothstep(0.0, 0.5, y));
                    } else {
                        hue = mix(yellow_h, blue_h, smoothstep(0.5, 1.0, y));
                    }

                    float saturation = mix(0.9, 1.0, isLightTheme);
                    float fadeOut = 1.0 - smoothstep(0.9, 1.0, vUv.x);
                    float value = smoothstep(0.0, 0.05, vUv.x) * pulse * fadeOut;
                    vec3 color = hsv2rgb(vec3(hue, saturation, value));
                    gl_FragColor = vec4(color, value * mix(1.0, 0.8, isLightTheme));
                }
            `,
            transparent: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
        });

        // Pyramid is the main object in the group, at the group's origin (0,0,0)
        const pyramidGeometry = new THREE.TetrahedronGeometry(pyramidRadius, 0);
        pyramid = new THREE.Mesh(pyramidGeometry, darkThemeMaterial);
        pyramid.rotation.set(basePyramidRotation.x, basePyramidRotation.y, basePyramidRotation.z);
        animationGroup.add(pyramid);

        const edgesGeometry = new THREE.EdgesGeometry(pyramid.geometry);
        const edgesMaterial = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.4, // More subtle
            depthWrite: false
        });
        pyramidEdges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
        pyramid.add(pyramidEdges); // Add to pyramid

        // Edges removed for a cleaner, more glassy look.

        // Beam setup
        const beamPivot = new THREE.Object3D();
        beamPivot.rotation.z = -0.3; // Corrected angle from top-left
        animationGroup.add(beamPivot); // Add to group, not pyramid
        const beamLength = 300;
        const beamGeometry = new THREE.CylinderGeometry(0.02, 0.02, beamLength, 32);
        beam = new THREE.Mesh(beamGeometry, beamMaterial);
        beam.rotation.z = Math.PI / 2;
        beam.position.x = -beamLength / 2;
        beamPivot.add(beam);

        // Spectrum setup
        const spectrumLength = 20;
        const spectrumGeometry = new THREE.PlaneGeometry(spectrumLength, 0.6, 64, 64);
        spectrum = new THREE.Mesh(spectrumGeometry, spectrumMaterial);
        spectrum.rotation.z = 0.3; // Symmetrical angle, based on image
        animationGroup.add(spectrum);

        // Internal refracted beam to show light bending
        internalBeamMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.9, // Increased opacity
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        // This group will contain the two segments, and its origin is the "bend" point.
        const refractedBeamGroup = new THREE.Group();
        refractedBeamGroup.renderOrder = 1; // Render after the prism

        const beamRadius = 0.03;
        const internalBeamLength = pyramidRadius * 0.5; // The short length that makes them look disconnected

        // --- Create a single geometry and material for both segments ---
        const internalBeamGeom = new THREE.CylinderGeometry(beamRadius, beamRadius, internalBeamLength, 32);
        
        // --- Segment 1 (Entry) ---
        const segment1 = new THREE.Mesh(internalBeamGeom, internalBeamMaterial);
        segment1.position.y = internalBeamLength / 2; // Position end at pivot
        const pivot1 = new THREE.Group();
        pivot1.add(segment1);
        // Align with the incoming beam's angle (-0.3 rad)
        // The cylinder's default is vertical (PI/2), so we adjust from there.
        pivot1.rotation.z = (Math.PI / 2) - 0.3;

        // --- Segment 2 (Exit) has been removed ---

        // Add pivots to the main group
        refractedBeamGroup.add(pivot1);

        // Position the entire bend point at the center of the prism
        refractedBeamGroup.position.y = 0;
        refractedBeamGroup.position.x = 0;

        animationGroup.add(refractedBeamGroup);

        clock = new THREE.Clock(); // Start the clock

        camera.position.z = 8;
        updateTheme();
        updatePosition(); // Set initial position
        updateScale(); // Set initial scale
        onResize(); // Force a final update to prevent initial render glitches

        // Set initial state for intro animation
        pyramid.scale.set(0.01, 0.01, 0.01); // Start prism almost invisible
        beam.material.opacity = 0;
        internalBeamMaterial.opacity = 0;
        spectrum.material.uniforms.pulse.value = 0.0; // Start spectrum with no intensity
        pyramidEdges.material.opacity = 0;
    }

    function updateTheme() {
        const theme = document.firstElementChild.getAttribute('data-theme');
        if (theme === 'cipher-light') {
            pyramid.material = lightThemeMaterial;
            if (pyramidEdges) pyramidEdges.material.color.set(0xaaaaaa); // Changed from 0x333333
        } else {
            pyramid.material = darkThemeMaterial;
            if (pyramidEdges) pyramidEdges.material.color.set(0xffffff); // White edges for dark theme
        }
    }

    function updatePosition() {
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const offsetPx = 1.5 * rem;
        const vFOV = camera.fov * Math.PI / 180;
        const height = 2 * Math.tan(vFOV / 2) * camera.position.z;
        const worldOffset = (offsetPx / renderer.domElement.clientHeight) * height;
        const bottomY = -height / 2;
        const yOffset = height * 0.05; // Move up by 10% of the screen height
        animationGroup.position.y = bottomY + pyramidRadius + yOffset;
    }

    function animate() {
        requestAnimationFrame(animate);

        const elapsedTime = clock.getElapsedTime();

        // --- INTRO ANIMATION ---
        if (elapsedTime < introDuration) {
            // Phase 1: Prism scales in (0s - 0.8s)
            const prismEndTime = 0.8;
            const prismScale = Math.min(1.0, elapsedTime / prismEndTime);
            if (pyramid.scale.x < 1.0) { // Avoid setting scale every frame after it's done
                pyramid.scale.set(prismScale, prismScale, prismScale);
            }
            pyramid.rotation.x = basePyramidRotation.x;
            pyramid.rotation.y = basePyramidRotation.y;
            pyramid.rotation.z = basePyramidRotation.z;

            // Phase 2: Beam fades in (0.8s - 1.0s)
            const beamStartTime = 0.8;
            const beamEndTime = 1.0;
            if (elapsedTime > beamStartTime) {
                const beamTime = (elapsedTime - beamStartTime) / (beamEndTime - beamStartTime);
                const beamOpacity = Math.min(1.0, beamTime);
                beam.material.opacity = beamOpacity * 0.85;
                internalBeamMaterial.opacity = beamOpacity * 0.9;
                if (pyramidEdges) pyramidEdges.material.opacity = beamOpacity * 0.4; // Fade in edges
            }

            // Phase 3: Spectrum fades in (1.0s - 2.5s)
            const spectrumStartTime = 1.0;
            if (elapsedTime > spectrumStartTime) {
                const spectrumTime = (elapsedTime - spectrumStartTime) / (introDuration - spectrumStartTime);
                const spectrumPulse = Math.min(1.0, spectrumTime);
                spectrum.material.uniforms.pulse.value = spectrumPulse;
            }

        } else {
            // --- LOOPING ANIMATION (Original logic) ---
            const loopTime = elapsedTime - introDuration;
            const pulse = 1.0 + 0.15 * Math.sin(loopTime * 2.0);
            spectrum.material.uniforms.pulse.value = pulse;

            // Position the entire group
            const mouseX = mouse.x * 0.1;
            animationGroup.position.x = mouseX * 2.0;

            // Rotate the PARENT object (pyramid). Children will follow.
            const mouseY = mouse.y * 0.1;
            const targetPyramidRotationY = basePyramidRotation.y - mouseX * 0.1;
            const targetPyramidRotationX = basePyramidRotation.x + mouseY * 0.1;
            pyramid.rotation.y += (targetPyramidRotationY - pyramid.rotation.y) * 0.05;
            pyramid.rotation.x += (targetPyramidRotationX - pyramid.rotation.x) * 0.05;
            pyramid.rotation.z += (basePyramidRotation.z - pyramid.rotation.z) * 0.05;
        }

        // This part is common to both intro and loop, so it stays outside the if/else
        // Set spectrum position relative to the group's center (where the pyramid is)
        const spectrumLength = 20;
        const offset = (spectrumLength / 2) + (pyramidRadius * 0.5);
        const offsetX = offset * Math.cos(spectrum.rotation.z);
        const offsetY = offset * Math.sin(spectrum.rotation.z);
        spectrum.position.set(offsetX, offsetY, 0);

        renderer.render(scene, camera);
    }

    function updateScale() {
        const scale = window.innerWidth < 768 ? 0.75 : 1.0;
        animationGroup.scale.set(scale, scale, scale);
    }

    function onResize() {
        camera.aspect = heroSection.offsetWidth / heroSection.offsetHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(heroSection.offsetWidth, heroSection.offsetHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        updatePosition(); // Call the new function on resize
        updateScale(); // Adjust scale for mobile
    }

    function onMouseMove(event) {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    init();
    animate();

    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', onMouseMove);

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.firstElementChild, { attributes: true, attributeFilter: ['data-theme'] });
});