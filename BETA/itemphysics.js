// === Item Physics Visual Effect para Miniblox ===
// Llama a esto cada vez que un item aparece en el mundo

function applyItemPhysics(itemMesh) {
    // Rotación inicial aleatoria sobre X y Z para "acostarlo"
    itemMesh.rotation.x = Math.random() * Math.PI / 2;
    itemMesh.rotation.z = Math.random() * Math.PI / 2;

    // Velocidad de "balanceo" y caída suave
    const rotationSpeed = (Math.random() - 0.5) * 0.01; // rotación lenta
    const floatAmplitude = 0.02 + Math.random() * 0.02; // leve flotación

    // Animación frame a frame
    function animatePhysics() {
        if (!itemMesh.parent) return; // si ya no está en escena, detener
        itemMesh.rotation.x += rotationSpeed;
        itemMesh.rotation.z += rotationSpeed;
        itemMesh.position.y += Math.sin(Date.now() * 0.001) * floatAmplitude; // pequeño "flote"
        requestAnimationFrame(animatePhysics);
    }

    animatePhysics();
}

// Ejemplo de aplicación a todos los items existentes
scene.traverse((obj) => {
    if (obj.isItem) { // marca items con isItem = true al crearlos
        applyItemPhysics(obj);
    }
});
