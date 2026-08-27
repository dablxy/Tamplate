/**
 * AZEXAI Monetization & Ads Integration
 * Contains Popunder, Social Bar, and Ad Banners
 */

// 1. Load Popunder Script dynamically before closing </head> or body
(function() {
    var popScript = document.createElement('script');
    popScript.src = "https://pl31054243.profitableratecpmnetwork.com/36/09/eb/3609eb41a262ed9ffa17dc73efa645d9.js";
    popScript.async = true;
    document.head.appendChild(popScript);

    // 2. Load Social Bar Script
    var socialScript = document.createElement('script');
    socialScript.src = "https://pl31054244.profitableratecpmnetwork.com/29/d2/36/29d23663506bb6ad85c439bf7d6a87c6.js";
    socialScript.async = true;
    document.body.appendChild(socialScript);
})();

// Helper function to render 728x90 Banner dynamically anywhere in the body
function renderBanner728x90(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var scriptOpt = document.createElement('script');
    scriptOpt.innerHTML = "atOptions = { 'key' : '7e27629a6e1fcc21ae98d5de550fca31', 'format' : 'iframe', 'height' : 90, 'width' : 728, 'params' : {} };";
    
    var scriptInvoke = document.createElement('script');
    scriptInvoke.src = "https://www.highrevenueformat.com/7e27629a6e1fcc21ae98d5de550fca31/invoke.js";
    scriptInvoke.async = true;

    container.appendChild(scriptOpt);
    container.appendChild(scriptInvoke);
}

// Helper function to render 300x250 Banner dynamically anywhere in the body
function renderBanner300x250(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var scriptOpt = document.createElement('script');
    scriptOpt.innerHTML = "atOptions = { 'key' : 'f0271ec3a9dc0c0e184169bb3f74a201', 'format' : 'iframe', 'height' : 250, 'width' : 300, 'params' : {} };";
    
    var scriptInvoke = document.createElement('script');
    scriptInvoke.src = "https://www.highrevenueformat.com/7e27629a6e1fcc21ae98d5de550fca31/invoke.js"; // Note: Highrevenueformat invoke shares the base or uses specific invoke if provided, let's keep original format
    scriptInvoke.src = "https://www.highrevenueformat.com/f0271ec3a9dc0c0e184169bb3f74a201/invoke.js"; // Adjusted based on standard patterns or keep general
    scriptInvoke.async = true;

    container.appendChild(scriptOpt);
    container.appendChild(scriptInvoke);
}
