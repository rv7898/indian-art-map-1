class EnhancedGlobalExplorer {
    constructor() {
        this.mapContainer = document.getElementById('map-container');
        this.svgWrapper = document.getElementById('svg-wrapper');
        this.topCountriesList = document.getElementById('top-countries-list');
        this.landmarkList = document.getElementById('landmark-list');
        this.countryDetails = document.getElementById('country-details');
        this.gdpData = {};
        this.scale = 1;
        this.translate = { x: 0, y: 0 };
        this.isPanning = false;
        this.startPoint = {};
        this.apiKey = '6e2a59c1eef74b4b91a143804241011';
        this.loadingScreen = document.querySelector('.loading-screen');
        this.init();
        if (window.innerWidth <= 768) {
            this.initMobileSidebar();
        }
    }

    initMobileSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const dragHandle = document.createElement('div');
        dragHandle.className = 'sidebar-drag-handle';
        const content = document.createElement('div');
        content.className = 'sidebar-content';
        while (sidebar.firstChild) {
            content.appendChild(sidebar.firstChild);
        }
        sidebar.appendChild(dragHandle);
        sidebar.appendChild(content);
        let startY = 0;
        let currentY = 0;
        let initialTransform = 0;
        let isDragging = false;
        let dragDistance = 0;
        dragHandle.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
            initialTransform = this.getTransformValue(sidebar);
            isDragging = true;
            dragDistance = 0;
            sidebar.style.transition = 'none';
        });
        dragHandle.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            currentY = e.touches[0].clientY;
            dragDistance = currentY - startY;
            const newTransform = Math.min(0, Math.max(initialTransform + dragDistance, -sidebar.offsetHeight + 60));
            sidebar.style.transform = `translateY(${newTransform}px)`;
        });
        dragHandle.addEventListener('touchend', () => {
            if (!isDragging) return;
            isDragging = false;
            sidebar.style.transition = 'transform 0.3s ease';
            const currentTransform = this.getTransformValue(sidebar);
            if (dragDistance < -100) {
                this.expandSidebar();
            } else if (dragDistance > 100) {
                this.collapseSidebar();
            } else {
                if (sidebar.classList.contains('expanded')) {
                    this.expandSidebar();
                } else {
                    this.collapseSidebar();
                }
            }
        });
        let lastTap = 0;
        dragHandle.addEventListener('click', (e) => {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTap;
            if (tapLength < 300 && tapLength > 0) {
                if (sidebar.classList.contains('expanded')) {
                    this.collapseSidebar();
                } else {
                    this.expandSidebar();
                }
                e.preventDefault();
            }
            lastTap = currentTime;
        });
    }

    expandSidebar() {
        const sidebar = document.querySelector('.sidebar');
        sidebar.style.transform = 'translateY(0)';
        sidebar.classList.add('expanded');
    }

    collapseSidebar() {
        const sidebar = document.querySelector('.sidebar');
        sidebar.style.transform = 'translateY(calc(100% - 60px))';
        sidebar.classList.remove('expanded');
    }

    getTransformValue(element) {
        const transform = window.getComputedStyle(element).transform;
        if (transform === 'none') return 0;
        const matrix = new DOMMatrix(transform);
        return matrix.m42;
    }

    async init() {
        this.showLoadingScreen();
        try {
            const response = await fetch('https://restcountries.com/v3.1/all');
            const data = await response.json();
            this.countryData = data.reduce((acc, country) => {
                acc[country.cca2] = {
                    id: country.cca2,
                    name: country.name.common,
                    population: country.population,
                    area: country.area,
                    capital: country.capital ? country.capital[0] : "N/A",
                    region: country.region,
                    climate: "Varied",
                    language: Object.values(country.languages || {}).join(", ") || "Unknown",
                };
                return acc;
            }, {});
            const svgResponse = await fetch('world-map.svg');
            const svgContent = await svgResponse.text();
            this.svgWrapper.innerHTML = svgContent;
            this.setupEventListeners();
            await this.renderTopCountries();
            this.initializeCountryInteractions();
            this.hideLoadingScreen();
        } catch (error) {
            console.error('Error during initialization:', error);
            this.hideLoadingScreen();
        }
    }

    showLoadingScreen() {
        this.loadingScreen.classList.remove('hidden');
    }

    hideLoadingScreen() {
        this.loadingScreen.classList.add('hidden');
    }

    setupEventListeners() {
        const naturalBtn = document.getElementById('btn-natural');
        const historicBtn = document.getElementById('btn-historic');
        const modernBtn = document.getElementById('btn-modern');
        if (naturalBtn) {
            naturalBtn.addEventListener('click', () => this.populateLandmarks('natural'));
        }
        if (historicBtn) {
            historicBtn.addEventListener('click', () => this.populateLandmarks('historic'));
        }
        if (modernBtn) {
            modernBtn.addEventListener('click', () => this.populateLandmarks('modern'));
        }
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const category = btn.dataset.category;
                if (category === 'gdp') {
                    await this.renderTopCountries(category);
                } else {
                    this.populateTopCountries(category);
                }
            });
        });
        document.querySelectorAll('.landmark-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.landmark-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.populateLandmarks(btn.dataset.type);
            });
        });
        this.mapContainer.addEventListener('touchstart', this.startTouchPan.bind(this), { passive: false });
        this.mapContainer.addEventListener('touchmove', this.doTouchPan.bind(this), { passive: false });
        this.mapContainer.addEventListener('touchend', this.endTouchPan.bind(this));
        this.mapContainer.addEventListener('wheel', this.handleZoom.bind(this));
        this.mapContainer.addEventListener('mousedown', this.startPan.bind(this));
        this.mapContainer.addEventListener('mousemove', this.doPan.bind(this));
        this.mapContainer.addEventListener('mouseup', this.endPan.bind(this));
        document.getElementById('zoom-in').addEventListener('click', () => this.zoom(0.2));
        document.getElementById('zoom-out').addEventListener('click', () => this.zoom(-0.2));
        document.getElementById('reset-view').addEventListener('click', this.resetView.bind(this));
    }

    startTouchPan(evt) {
        if (evt.touches.length === 2) {
            this.isPinching = true;
            const [touch1, touch2] = evt.touches;
            this.startDistance = Math.hypot(
                touch2.pageX - touch1.pageX,
                touch2.pageY - touch1.pageY
            );
            this.startScale = this.scale;
        } else if (evt.touches.length === 1) {
            this.isPanning = true;
            this.startPoint = {
                x: evt.touches[0].pageX,
                y: evt.touches[0].pageY,
            };
        }
    }

    doTouchPan(evt) {
        if (this.isPinching && evt.touches.length === 2) {
            const [touch1, touch2] = evt.touches;
            const currentDistance = Math.hypot(
                touch2.pageX - touch1.pageX,
                touch2.pageY - touch1.pageY
            );
            const zoomAmount = (currentDistance - this.startDistance) / 2000;
            this.zoom(zoomAmount, true);
        } else if (this.isPanning && evt.touches.length === 1) {
            const dx = evt.touches[0].pageX - this.startPoint.x;
            const dy = evt.touches[0].pageY - this.startPoint.y;
            this.translate.x += dx;
            this.translate.y += dy;
            this.updateMapTransform();
            this.startPoint = {
                x: evt.touches[0].pageX,
                y: evt.touches[0].pageY,
            };
        }
    }

    endTouchPan() {
        this.isPanning = false;
    }

    async showCountryDetails(countryName) {
        const country = this.countryData[countryName];
        if (!country) {
            console.error("Country data not found:", countryName);
            return;
        }
        let weatherDisplay = 'N/A';
        let gdpData = {
            gdpNominal: 'N/A',
            gdpGrowth: 'N/A',
            gdpPerCapitaNominal: 'N/A',
            gdpPpp: 'N/A',
            year: 'Unknown'
        };
        try {
            const weather = await this.getWeatherData(country.name);
            weatherDisplay = `${weather.temperature}°C, ${weather.condition}`;
        } catch (err) {
            console.error("Error fetching weather data:", err);
        }
        try {
            gdpData = await this.getGdpData(country.name);
        } catch (err) {
            console.error("Error fetching GDP data:", err);
        }
        this.countryDetails.innerHTML = `
            <h4>${country.name}</h4>
            <p><strong>Population:</strong> ${country.population.toLocaleString()}</p>
            <p><strong>Capital:</strong> ${country.capital || 'N/A'}</p>
            <p><strong>Region:</strong> ${country.region || 'N/A'}</p>
            <p><strong>Language:</strong> ${country.language || 'N/A'}</p>
            <p><strong>Weather:</strong> ${weatherDisplay}</p>
            <p><strong>Climate:</strong> ${country.climate || 'N/A'}</p>
            <p><strong>GDP Nominal (in ${gdpData.year}):</strong> ${gdpData.gdpNominal}</p>
            <p><strong>GDP Growth:</strong> ${gdpData.gdpGrowth}</p>
            <p><strong>GDP Per Capita (Nominal):</strong> ${gdpData.gdpPerCapitaNominal}</p>
            <p><strong>GDP PPP:</strong> ${gdpData.gdpPpp}</p>
        `;
    }

    initializeCountryInteractions() {
        const countries = document.querySelectorAll('svg path');
        if (countries.length === 0) {
            console.error("No countries found in the SVG.");
            return;
        }
        countries.forEach(country => {
            country.addEventListener('click', async () => {
                const countryName = country.id;
                console.log("Clicked on country:", countryName);
                await this.showCountryDetails(countryName);
            });
        });
    }

    async getWeatherData(countryName) {
        const apiKey = '6e2a59c1eef74b4b91a143804241011';
        const urlString = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${countryName}`;
        try {
            console.log("Fetching weather for:", countryName);
            const response = await fetch(urlString);
            if (!response.ok) {
                console.error("API Error:", response.statusText);
                throw new Error(`Error: ${response.status}`);
            }
            const weatherData = await response.json();
            console.log("Weather Data:", weatherData);
            return {
                temperature: weatherData.current.temp_c.toFixed(1),
                condition: weatherData.current.condition.text
            };
        } catch (err) {
            console.error('Error fetching weather data:', err);
            return { temperature: 'N/A', condition: 'Unknown' };
        }
    }

    async getGdpData(countryName) {
        const apiKey = 'L7qjJBm8kt3Bha24yMTqNQ==anE999VDbq7GFVGX';
        const urlString = `https://api.api-ninjas.com/v1/gdp?country=${encodeURIComponent(countryName)}`;
        try {
            const response = await fetch(urlString, {
                method: 'GET',
                headers: { 'X-Api-Key': apiKey },
            });
            const gdpData = await response.json();
            console.log(`GDP data for ${countryName}:`, gdpData);
            if (!response.ok || !gdpData || gdpData.length === 0) {
                return {
                    gdpNominal: 'N/A',
                    gdpGrowth: 'N/A',
                    gdpPerCapitaNominal: 'N/A',
                    gdpPpp: 'N/A',
                    year: 'Unknown',
                };
            }
            const latestData = gdpData.find(data => data.year >= 2024 && data.year <= 2029);
            if (!latestData) {
                console.warn(`No GDP data available for ${countryName} in the year range 2024–2029.`);
                return {
                    gdpNominal: 'N/A',
                    gdpGrowth: 'N/A',
                    gdpPerCapitaNominal: 'N/A',
                    gdpPpp: 'N/A',
                    year: 'Unknown',
                };
            }
            return {
                gdpNominal: latestData.gdp_nominal
                    ? `$${latestData.gdp_nominal.toFixed(2)} Billion`
                    : 'N/A',
                gdpGrowth: latestData.gdp_growth || 'N/A',
                gdpPerCapitaNominal: latestData.gdp_per_capita_nominal
                    ? `$${latestData.gdp_per_capita_nominal.toFixed(2)}`
                    : 'N/A',
                gdpPpp: latestData.gdp_ppp
                    ? `$${latestData.gdp_ppp.toFixed(2)}`
                    : 'N/A',
                year: latestData.year || 'Unknown',
            };
        } catch (error) {
            console.error("Error fetching GDP data:", error);
            return {
                gdpNominal: 'N/A',
                gdpGrowth: 'N/A',
                gdpPerCapitaNominal: 'N/A',
                gdpPpp: 'N/A',
                year: 'Unknown',
            };
        }
    }

    async renderTopCountries(category) {
        console.log('Fetching GDP data for top countries...');
        const promises = Object.values(this.countryData).map(async (country) => {
            const gdpData = await this.getGdpData(country.name);
            this.gdpData[country.name] = gdpData;
            return {
                ...country,
                gdp: parseFloat(gdpData.gdpNominal.replace('Billion', '').replace('$', '')) || 0,
            };
        });
        const countriesWithGdp = await Promise.all(promises);
        this.populateTopCountries(category, countriesWithGdp);
    }

    async populateTopCountries(category) {
        console.log('Running populateTopCountries with category:', category);
        const sortedCountries = await Promise.all(
            Object.values(this.countryData).map(async (country) => {
                let gdp = 0;
                if (category === 'gdp') {
                    const gdpData = await this.getGdpData(country.name);
                    gdp = parseFloat(gdpData.gdpNominal.replace(/[$,Billion]/g, '')) || 0;
                }
                return {
                    ...country,
                    gdp,
                };
            })
        );
        const sortedByCategory = sortedCountries.sort((a, b) => {
            if (category === 'population') return b.population - a.population;
            if (category === 'gdp') return b.gdp - a.gdp;
            return b.area - a.area;
        });
        const topCountries = sortedByCategory.slice(0, 5);
        console.log('Top Countries to render:', topCountries);
        this.topCountriesList.innerHTML = topCountries
            .map((country, index) => `
                <li>
                    <span>${index + 1}. ${country?.name || 'Unknown'}</span>
                    <span>
                        ${
                            category === 'population'
                                ? country?.population?.toLocaleString() || 'N/A'
                                : category === 'gdp'
                                ? `$${country.gdp.toFixed(2)} Billion`
                                : `${country?.area?.toLocaleString()} km²`
                        }
                    </span>
                </li>
            `)
            .join('');
    }

    async fetchLandmarks(city) {
        const url = "https://api.map-places.com/place?type=landmark&location=" + city;
        try {
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "X-RapidAPI-Host": "map-places.p.rapidapi.com",
                    "X-RapidAPI-Key": "0226555673msh4d240210531e692p11ce36jsn89e56685839f"
                }
            });
            if (!response.ok) {
                throw new Error('Failed to fetch landmarks');
            }
            const data = await response.json();
            this.populateLandmarks(data);
        } catch (error) {
            console.error("Error fetching landmarks:", error);
        }
    }

    populateLandmarks(data) {
        this.landmarkList.innerHTML = "";
        if (data && data.length > 0) {
            data.forEach(landmark => {
                const listItem = document.createElement('div');
                listItem.textContent = `${landmark.name}`;
                listItem.className = 'landmark-item';
                this.landmarkList.appendChild(listItem);
            });
        } else {
            this.landmarkList.innerHTML = "<p>No landmarks found</p>";
        }
    }

    zoom(amount) {
        this.scale += amount;
        this.scale = Math.max(this.scale, 0.5);
        this.scale = Math.min(this.scale, 5);
        this.updateMapTransform();
    }

    handleZoom(evt) {
        evt.preventDefault();
        const zoomAmount = evt.deltaY < 0 ? 0.2 : -0.2;
        this.zoom(zoomAmount);
    }

    startPan(evt) {
        this.isPanning = true;
        this.startPoint = { x: evt.pageX, y: evt.pageY };
    }

    doPan(evt) {
        if (!this.isPanning) return;
        const dx = evt.pageX - this.startPoint.x;
        const dy = evt.pageY - this.startPoint.y;
        this.translate.x += dx;
        this.translate.y += dy;
        this.startPoint = { x: evt.pageX, y: evt.pageY };
        this.updateMapTransform();
    }

    endPan() {
        this.isPanning = false;
    }

    resetView() {
        this.scale = 1;
        this.translate = { x: 0, y: 0 };
        this.updateMapTransform();
    }

    updateMapTransform() {
        this.svgWrapper.style.transform = `translate(${this.translate.x}px, ${this.translate.y}px) scale(${this.scale})`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new EnhancedGlobalExplorer();
    const watermark = document.querySelector('.watermark');
    watermark.addEventListener('click', () => {
        watermark.style.transform = 'scale(1.1)';
        setTimeout(() => {
            watermark.style.transform = 'scale(1)';
        }, 200);
    });
});
