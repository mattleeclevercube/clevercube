document.addEventListener('DOMContentLoaded', () => {

    // --- GLOBAL STATE & CONFIG ---
    let scene, camera, renderer, controls, cubeGroup;
    let selectedPieces = []; // This will be populated by the solve function
    const CUBE_SIZE = 3;
    let previewInstances = []; // Holds all the 3D preview instances

    const statusEl = document.getElementById('status');
    const solveButton = document.getElementById('solve-button');
    const resetButton = document.getElementById('reset-button');
    const selectorContainerEl = document.getElementById('piece-selector-container');

    // --- NEW CONFIGURATION FOR COLOR/PIECE SELECTION ---
    const COLOR_SELECTORS = {
        'Red':    0xff0000,
        'Orange': 0xffa500,
        'Yellow': 0xffff00,
        'Green':  0x008000,
        'Blue':   0x0000ff,
        'Purple': 0x800080
    };
    // New mapping from dropdown number to piece name
    const PIECE_MAPPING = {
        '1': 'L', '3': 'T', '4': 'S', '2': 'Z', '5': 'P', '6': 'B'
    };

    // --- POLYOMINO DEFINITIONS (SOMA CUBE PIECES) ---
    const PIECES = {
        'L': { volume: 4, color: 0x00A0B0, shape: [[0,0,0], [1,0,0], [2,0,0], [0,1,0]] },
        'T': { volume: 4, color: 0x6A4A3C, shape: [[0,0,0], [1,0,0], [2,0,0], [1,1,0]] },
        'Z': { volume: 4, color: 0xCC333F, shape: [[0,0,0], [1,0,0], [1,1,0], [2,1,0]] },
        'S': { volume: 4, color: 0xEB6841, shape: [[0,0,0], [1,0,0], [1,1,0], [0,0,1]] },
        'A': { volume: 3, color: 0xffffff, shape: [[0,0,0], [1,0,0], [0,1,0]] },
        'B': { volume: 4, color: 0x8BC34A, shape: [[0,0,0], [1,0,0], [0,1,0], [0,0,1]] },
        'P': { volume: 4, color: 0x955251, shape: [[0,0,0], [0,1,0], [1,1,0], [0,0,1]] }
    };

    // --- INITIALIZATION ---
    initUI();
    init3D();

    // --- UI LOGIC ---
    function initUI() {
        let previewIndex = 0;
        for (const [colorName, colorHex] of Object.entries(COLOR_SELECTORS)) {
            const selectorDiv = document.createElement('div');
            selectorDiv.classList.add('color-selector');
            
            const controlsDiv = document.createElement('div');
            controlsDiv.classList.add('selector-controls');

            const label = document.createElement('label');
            label.textContent = colorName;
            label.style.backgroundColor = `#${colorHex.toString(16).padStart(6, '0')}`;
            if (['Yellow', 'Orange', 'Green'].includes(colorName)) label.style.color = '#333';

            const select = document.createElement('select');
            select.id = `select-${colorName}`;
            select.dataset.previewIndex = previewIndex; // Link select to its preview

            for (const key of Object.keys(PIECE_MAPPING)) {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = `Piece ${key}`;
                select.appendChild(option);
            }

            const previewContainer = document.createElement('div');
            previewContainer.classList.add('piece-preview');

            controlsDiv.appendChild(label);
            controlsDiv.appendChild(select);
            selectorDiv.appendChild(controlsDiv);
            selectorDiv.appendChild(previewContainer);
            selectorContainerEl.appendChild(selectorDiv);

            // Create a 3D preview for this selector
            const initialPieceName = PIECE_MAPPING[select.value];
            const initialShape = PIECES[initialPieceName].shape;
            const preview = initPreviewScene(previewContainer, initialShape, colorHex);
            previewInstances.push(preview);
            
            select.addEventListener('change', (e) => {
                const selectedPieceNum = e.target.value;
                const newPieceName = PIECE_MAPPING[selectedPieceNum];
                const newShape = PIECES[newPieceName].shape;
                const idx = parseInt(e.target.dataset.previewIndex, 10);
                const color = COLOR_SELECTORS[colorName];
                drawPieceInPreview(previewInstances[idx].pieceGroup, newShape, color);
            });
            previewIndex++;
        }

        solveButton.addEventListener('click', solve);
        resetButton.addEventListener('click', reset);
    }

    function reset() {
        for (const [index, [colorName, colorHex]] of Object.entries(Object.entries(COLOR_SELECTORS))) {
            const select = document.getElementById(`select-${colorName}`);
            if(select) select.value = '1';
            
            // Update preview to match reset
            const pieceName = PIECE_MAPPING['1'];
            const shape = PIECES[pieceName].shape;
            drawPieceInPreview(previewInstances[index].pieceGroup, shape, colorHex);
        }

        if (cubeGroup) {
            while (cubeGroup.children.length > 0) cubeGroup.remove(cubeGroup.children[0]);
        }
        drawGrid();
        statusEl.textContent = 'Configuration reset. Press "Solve".';
    }
    
    // --- 3D PREVIEW LOGIC ---
    function initPreviewScene(container, pieceShape, pieceColor) {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(35, container.clientWidth / container.clientHeight, 0.1, 100);
        camera.position.set(3, 3, 4);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(renderer.domElement);

        const ambient = new THREE.AmbientLight(0xffffff, 0.7);
        scene.add(ambient);
        const directional = new THREE.DirectionalLight(0xffffff, 0.5);
        directional.position.set(1, 2, 0.5);
        scene.add(directional);

        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableZoom = false;
        controls.enablePan = false;

        const pieceGroup = new THREE.Group();
        scene.add(pieceGroup);
        
        drawPieceInPreview(pieceGroup, pieceShape, pieceColor);

        return { renderer, scene, camera, controls, pieceGroup };
    }

    function drawPieceInPreview(pieceGroup, pieceShape, pieceColor) {
        // Clear existing piece
        while(pieceGroup.children.length) pieceGroup.remove(pieceGroup.children[0]);
        
        const material = new THREE.MeshLambertMaterial({ color: pieceColor });
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const edges = new THREE.EdgesGeometry(geometry);

        pieceShape.forEach(coord => {
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(coord[0], coord[1], coord[2]);
            const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, opacity: 0.5, transparent: true }));
            mesh.add(line);
            pieceGroup.add(mesh);
        });

        // Center the piece in the preview
        new THREE.Box3().setFromObject(pieceGroup).getCenter(pieceGroup.position).multiplyScalar(-1);
    }
    
    // --- MAIN 3D SCENE LOGIC ---
    function init3D() {
        const container = document.getElementById('canvas-container');
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x282c34);

        camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
        camera.position.set(5, 5, 5);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(renderer.domElement);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 5);
        scene.add(directionalLight);

        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        
        cubeGroup = new THREE.Group();
        scene.add(cubeGroup);

        drawGrid();
        animate();
    }

    function animate() {
        requestAnimationFrame(animate);
        // Main scene
        controls.update();
        renderer.render(scene, camera);
        // Preview scenes
        previewInstances.forEach(inst => {
            inst.controls.update();
            inst.renderer.render(inst.scene, inst.camera);
        });
    }
    
    function drawGrid() {
        const geometry = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
        const edges = new THREE.EdgesGeometry(geometry);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 }));
        line.position.set((CUBE_SIZE - 1) / 2, (CUBE_SIZE - 1) / 2, (CUBE_SIZE - 1) / 2);
        cubeGroup.add(line);
    }

    function drawSolution(solution) {
        while (cubeGroup.children.length > 0) cubeGroup.remove(cubeGroup.children[0]);
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const edges = new THREE.EdgesGeometry(geometry);
        solution.forEach(placement => {
            const piece = selectedPieces[placement.pieceIndex];
            const material = new THREE.MeshLambertMaterial({ color: piece.color });
            placement.coords.forEach(coord => {
                const [x, y, z] = coord;
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.set(x, y, z);
                const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5}));
                mesh.add(line);
                cubeGroup.add(mesh);
            });
        });
        cubeGroup.position.set(-(CUBE_SIZE - 1) / 2, -(CUBE_SIZE - 1) / 2, -(CUBE_SIZE - 1) / 2);
    }

    // --- GEOMETRY & ROTATION LOGIC ---
    function generateRotations(shape) {
        const rotations = new Set();
        let currentShape = shape.map(p => [...p]);
        for (let cycle = 0; cycle < 2; cycle++) {
            for (let step = 0; step < 3; step++) {
                currentShape = currentShape.map(([x, y, z]) => [x, z, -y]);
                for (let i = 0; i < 4; i++) {
                    currentShape = currentShape.map(([x, y, z]) => [-y, x, z]);
                    const minX = Math.min(...currentShape.map(p => p[0]));
                    const minY = Math.min(...currentShape.map(p => p[1]));
                    const minZ = Math.min(...currentShape.map(p => p[2]));
                    const normalized = currentShape
                        .map(([x, y, z]) => [x - minX, y - minY, z - minZ])
                        .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
                    rotations.add(JSON.stringify(normalized));
                }
            }
            currentShape = currentShape.map(([x, y, z]) => [-z, y, x]);
        }
        return Array.from(rotations).map(s => JSON.parse(s));
    }

    // --- SOLVER LOGIC ---
    function solve() {
        statusEl.textContent = 'Constructing problem matrix...';
        solveButton.disabled = true;
        resetButton.disabled = true;

        selectedPieces = [];
        selectedPieces.push({ name: 'A', ...PIECES['A'] });

        for (const [colorName, colorHex] of Object.entries(COLOR_SELECTORS)) {
            const select = document.getElementById(`select-${colorName}`);
            const pieceNumber = select.value;
            const pieceName = PIECE_MAPPING[pieceNumber]; // Use new mapping
            const originalPiece = PIECES[pieceName];
            selectedPieces.push({
                name: pieceName,
                volume: originalPiece.volume,
                shape: originalPiece.shape,
                color: colorHex
            });
        }
        
        setTimeout(() => {
            const matrix = buildExactCoverMatrix(selectedPieces);
            statusEl.textContent = 'Searching for a solution with DLX...';
            setTimeout(() => {
                const solution = findFirstSolution(matrix);
                if (solution) {
                    statusEl.textContent = '✅ Solution Found!';
                    drawSolution(solution);
                } else {
                    statusEl.textContent = '❌ No solution found for this combination.';
                }
                solveButton.disabled = false;
                resetButton.disabled = false;
            }, 50);
        }, 50);
    }

    function buildExactCoverMatrix(pieces) {
        const numVoxels = CUBE_SIZE * CUBE_SIZE * CUBE_SIZE;
        const numPieces = pieces.length;
        const columns = Array.from({ length: numVoxels + numPieces }, (_, i) => i);
        const rows = [];
        const placements = [];
        pieces.forEach((piece, pieceIndex) => {
            const allRotations = generateRotations(piece.shape);
            allRotations.forEach(rotation => {
                const maxX = Math.max(...rotation.map(p => p[0]));
                const maxY = Math.max(...rotation.map(p => p[1]));
                const maxZ = Math.max(...rotation.map(p => p[2]));
                for (let x = 0; x <= CUBE_SIZE - 1 - maxX; x++) {
                    for (let y = 0; y <= CUBE_SIZE - 1 - maxY; y++) {
                        for (let z = 0; z <= CUBE_SIZE - 1 - maxZ; z++) {
                            const newRow = [numVoxels + pieceIndex];
                            const placedCoords = [];
                            rotation.forEach(voxel => {
                                const vx = voxel[0] + x;
                                const vy = voxel[1] + y;
                                const vz = voxel[2] + z;
                                newRow.push(vz * CUBE_SIZE * CUBE_SIZE + vy * CUBE_SIZE + vx);
                                placedCoords.push([vx, vy, vz]);
                            });
                            rows.push(newRow);
                            placements.push({ pieceIndex, coords: placedCoords });
                        }
                    }
                }
            });
        });
        return { columns, rows, placements };
    }

    // --- DANCING LINKS (DLX) IMPLEMENTATION ---
    function findFirstSolution({ columns, rows, placements }) {
        const header = { R: null, L: null, name: 'header' };
        header.R = header.L = header;
        const colNodes = [];
        columns.forEach(colName => {
            const newNode = { R: header, L: header.L, U: null, D: null, C: null, S: 0, name: colName };
            newNode.U = newNode.D = newNode;
            newNode.C = newNode;
            header.L.R = newNode;
            header.L = newNode;
            colNodes.push(newNode);
        });
        rows.forEach((row, rowIndex) => {
            let firstNode = null;
            row.forEach(colIndex => {
                const colHeader = colNodes[colIndex];
                const newNode = { R: null, L: null, U: colHeader.U, D: colHeader, C: colHeader, rowIndex };
                colHeader.U.D = newNode;
                colHeader.U = newNode;
                colHeader.S++;
                if (!firstNode) {
                    firstNode = newNode;
                    firstNode.R = firstNode.L = firstNode;
                } else {
                    newNode.R = firstNode;
                    newNode.L = firstNode.L;
                    firstNode.L.R = newNode;
                    firstNode.L = newNode;
                }
            });
        });
        let solution = null;
        function search(k, currentSolution) {
            if (header.R === header) {
                solution = currentSolution.map(rowIndex => placements[rowIndex]);
                return true;
            }
            let c = header.R;
            for (let j = c.R; j !== header; j = j.R) if (j.S < c.S) c = j;
            cover(c);
            for (let r = c.D; r !== c; r = r.D) {
                currentSolution.push(r.rowIndex);
                for (let j = r.R; j !== r; j = j.R) cover(j.C);
                if (search(k + 1, currentSolution)) return true;
                currentSolution.pop();
                for (let j = r.L; j !== r; j = j.L) uncover(j.C);
            }
            uncover(c);
            return false;
        }
        function cover(c) {
            c.R.L = c.L; c.L.R = c.R;
            for (let i = c.D; i !== c; i = i.D) {
                for (let j = i.R; j !== i; j = j.R) {
                    j.D.U = j.U; j.U.D = j.D; j.C.S--;
                }
            }
        }
        function uncover(c) {
            for (let i = c.U; i !== c; i = i.U) {
                for (let j = i.L; j !== i; j = j.L) {
                    j.C.S++; j.D.U = j; j.U.D = j;
                }
            }
            c.R.L = c; c.L.R = c;
        }
        search(0, []);
        return solution;
    }
});
