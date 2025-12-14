// Function to handle the actual loading of the image
function loadImage(imageElement) {
    // Exit if the image is already loading (href is set)
    if (imageElement.getAttribute('href')) {
        return; 
    }
    
    // Get the image source from the data-href attribute
    const url = imageElement.getAttribute('data-href');
    if (url) {
        // Set the href attribute to trigger the browser to load the image
        imageElement.setAttribute('href', url);
        
        // Optional: you might want to remove the 'data-href' attribute after loading
        // imageElement.removeAttribute('data-href');
    }
}

// 1. Get all image elements that need lazy loading
const lazyImages = document.querySelectorAll('#main-svg image');

// 2. Setup Intersection Observer (Modern Browsers)
if ('IntersectionObserver' in window) {
    
    // Create a new observer instance
    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            // Check if the image element is entering the viewport
            if (entry.isIntersecting) {
                const imageElement = entry.target;
                loadImage(imageElement);
                // Stop observing this element once it's loaded to save resources
                observer.unobserve(imageElement);
            }
        });
    }, {
        // rootMargin: We load the image when it is within 1000px horizontally 
        // of the viewport, giving the browser time to fetch it before the user sees an empty spot.
        rootMargin: '0px 1000px 0px 1000px', 
        threshold: 0.01 // Minimal visibility needed to trigger the load
    });

    // Start observing all lazy image elements
    lazyImages.forEach(image => {
        observer.observe(image);
    });
    
} else {
    // Fallback for very old browsers: load all images immediately
    lazyImages.forEach(image => {
        loadImage(image);
    });
}