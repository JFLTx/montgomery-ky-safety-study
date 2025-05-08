// KABCO severity categories
const kabcoVals = [
  {
    id: "K",
    text: "Fatal Crash",
    color: "#330601",
    size: 12,
    checked: true,
  },
  {
    id: "A",
    text: "Serious Injury Crash",
    color: "#8c1001",
    size: 10,
    checked: true,
  },
  {
    id: "B",
    text: "Minor Injury Crash",
    color: "#fc1d03",
    size: 7.5,
    checked: true,
  },
  {
    id: "C",
    text: "Possible Injury Crash",
    color: "#fc9083",
    size: 5,
    checked: true,
  },
  {
    id: "O",
    text: "Property Damage Only",
    color: "#fae1de",
    size: 4,
    checked: true,
  },
];

// Spinner control
function showSpinner() {
  const spinner = document.querySelector(".spinner-container");
  if (spinner) spinner.style.display = "flex";
}

function hideSpinner() {
  const spinner = document.querySelector(".spinner-container");
  if (spinner) spinner.style.display = "none";
}

// Time groupings for slider
const timeGroups = [
  { label: "12:00 AM - 2:59 AM", range: [0, 259] },
  { label: "3:00 AM - 5:59 AM", range: [300, 559] },
  { label: "6:00 AM - 8:59 AM", range: [600, 859] },
  { label: "9:00 AM - 11:59 AM", range: [900, 1159] },
  { label: "12:00 PM - 2:59 PM", range: [1200, 1459] },
  { label: "3:00 PM - 5:59 PM", range: [1500, 1759] },
  { label: "6:00 PM - 8:59 PM", range: [1800, 2059] },
  { label: "9:00 PM - 11:59 PM", range: [2100, 2359] },
];

// global states for data in map
let currentFilteredData = [];
let currentTimeIndex = 0;
let currentManner = "All";
let crashData = null;
let currentYear = "All";

// Load data and start map
async function loadData() {
  showSpinner(); // show spinner when data starts being accessed
  try {
    const [joinedRoads, HIN] = await Promise.all([
      d3.json("data/Joined_Roads_Result2.geojson"),
      d3.json("data/HIN_2.geojson"),
    ]);

    crashData = await d3.json("data/crashes_WGS84.geojson");
    createMap(joinedRoads, HIN, crashData);

    console.log(`Loaded ${crashData.features.length} crashes.`);
  } catch (err) {
    console.error("Data loading error:", err);
    hideSpinner(); // hide spinner once data is accessed
  }
}

// define function to retrieve the bounds of a layer
function getBounds(geojson) {
  const bounds = new maplibregl.LngLatBounds();
  geojson.features.forEach((feature) => {
    const coords = feature.geometry.coordinates;
    if (feature.geometry.type === "Point") {
      bounds.extend(coords);
    } else if (feature.geometry.type === "LineString") {
      coords.forEach((coord) => bounds.extend(coord));
    } else if (feature.geometry.type === "Polygon") {
      coords[0].forEach((coord) => bounds.extend(coord));
    }
  });
  return bounds;
}

// helper function for increased interactivity tolerance
// this works on popups
function addHitboxLayer({
  map,
  sourceId,
  baseLayerId,
  hitboxLayerId,
  width = 10,
}) {
  map.addLayer(
    {
      id: hitboxLayerId,
      type: "line",
      source: sourceId,
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "transparent", // Invisible hitbox
        "line-width": width,
      },
    },
    baseLayerId
  ); // insert below the base layer
}

function createMap(joinedRoads, HIN, crashData) {
  map = new maplibregl.Map({
    container: "map",
    style:
      "https://api.maptiler.com/maps/933ba1d3-2d03-46b6-8ed9-9eb848c5b585/style.json?key=0zqiZBhi9odGfce84wRZ",
    center: [-84.3, 37.6],
    zoom: 11,
    clickTolerance: 7.5,
  });

  map.on("load", () => {
    // Add crash points
    map.addSource("crashes", {
      type: "geojson",
      data: crashData,
    });
    // Add HIN layer
    map.addSource("hin", {
      type: "geojson",
      data: HIN,
    });
    map.addSource("joinedRoads", {
      type: "geojson",
      data: joinedRoads,
    });

    map.addLayer({
      id: "crashes",
      type: "circle",
      source: "crashes",
      paint: {
        "circle-radius": [
          "match",
          ["get", "KABCO"],
          ...kabcoVals.flatMap((k) => [k.id, k.size]), // gets the id values and the corresponding sizes in an easy to read line of code, defaults the size to 3 if not matched
          3,
        ],
        "circle-color": [
          "match",
          ["get", "KABCO"],
          ...kabcoVals.flatMap((k) => [k.id, k.color]), // gets the id values and the corresponding colors in an easy to read line of code, defaults the color to #999999 if not matched
          "#999999",
        ],
        "circle-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          10,
          0,
          12.5,
          0.8,
        ],
        "circle-stroke-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          10,
          0,
          12.5,
          0.8,
        ],
        "circle-stroke-color": "#222",
      },
    });

    // Outer soft glow
    map.addLayer(
      {
        id: "hin-glow-outer",
        type: "line",
        source: "hin",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#ff0000",
          "line-opacity": 0.1,
          "line-width": ["interpolate", ["linear"], ["zoom"], 10, 8, 14, 30],
          "line-blur": 8,
        },
      },
      "crashes" // data is added before the crashes load, so renders beneath the crashes layer
    );

    // Mid glow
    map.addLayer(
      {
        id: "hin-glow-mid",
        type: "line",
        source: "hin",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#ff0000",
          "line-opacity": 0.2,
          "line-width": ["interpolate", ["linear"], ["zoom"], 10, 4, 14, 16],
          "line-blur": 3,
        },
      },
      "crashes"
    );

    // Core bright stroke
    map.addLayer(
      {
        id: "hin-core",
        type: "line",
        source: "hin",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#ff2b2b", // neon red
          "line-width": 4,
          "line-opacity": 1,
        },
      },
      "crashes"
    );

    // joined roads layer with crash per segment info
    map.addLayer(
      {
        id: "joinedRoads-line",
        type: "line",
        source: "joinedRoads",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#53555c",
          "line-width": 1.5,
          "line-opacity": 0.7,
        },
      },
      "hin-core"
    ); // Ensure it renders below HIN

    addHitboxLayer({
      map,
      sourceId: "joinedRoads",
      baseLayerId: "joinedRoads-line",
      hitboxLayerId: "joinedRoads-hitbox",
      width: 8, // Adjust as needed
    });

    // add hitbox layer for the HIN core MapLibre layer
    addHitboxLayer({
      map,
      sourceId: "hin",
      baseLayerId: "hin-core",
      hitboxLayerId: "hin-hitbox",
      width: 10, // width adjusts the tolerance of interactivity
    });

    // crash density/heat layer
    map.addLayer({
      id: "heatLayer",
      type: "heatmap",
      source: "crashes",
      paint: {
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0,
          "rgba(33,102,172,0)",
          0.5,
          "rgba(103,169,207,0.75)",
          0.6,
          "rgba(209,229,240,0.9)",
          0.75,
          "rgba(253,219,199,0.9)",
          0.9,
          "rgba(239,138,98,0.9)",
          1,
          "rgba(178,24,43,1)",
        ],
        "heatmap-weight": [
          // Assign weight value to KABCO value id's in kabcoVals
          "match",
          ["get", "KABCO"],
          "K",
          5,
          "A",
          4,
          "B",
          3,
          "C",
          2,
          "O",
          1,
          0,
        ],
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 6, 10, 13, 20],
        "heatmap-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          10,
          0.8,
          13,
          0,
        ],
      },
    });

    // Popups
    map.on("click", (e) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ["crashes", "hin-hitbox", "joinedRoads-hitbox"],
      });

      if (!features.length) return;

      // Prioritize crash layer over HIN layer
      const crash = features.find((f) => f.layer.id === "crashes");
      const hin = features.find((f) => f.layer.id === "hin-hitbox");
      const joined = features.find((f) => f.layer.id === "joinedRoads-hitbox");

      if (crash) {
        const props = crash.properties;
        const severity =
          kabcoVals.find((k) => k.id === props.KABCO)?.text || "Unknown";
        const roadway =
          props.RoadwayName?.trim() || props.RdwyNumber?.trim() || "UNKNOWN";
        const streetSfx = props.StreetSfx?.trim();
        const collisionOn = streetSfx ? `${roadway} ${streetSfx}` : roadway;

        const lat = props.Latitude;
        const lon = props.Longitude;

        const streetViewURL = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`;

        const popupHTML = `
          <strong>Manner of Collision:</strong> ${
            props.MannerofCollision?.trim() || "UNKNOWN"
          }<br>
          <strong>Collision On:</strong> ${collisionOn}<br>
          <strong>Collision Date:</strong> ${props.CollisionDate}<br>
          <strong>Collision Time:</strong> ${props.CollisionTime}<br>
          <strong>Crash Severity:</strong> ${severity}<br>
          <strong><a href="${streetViewURL}" target="_blank">Google Street View</a></strong><br>
        `;

        new maplibregl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(popupHTML)
          .addTo(map);
      } else if (hin) {
        const props = hin.properties;

        const popupHTML = `
          <strong>Route:</strong> ${props.RT_UNIQUE}<br>
          <strong>Fatal & Suspected Serious Injury Crashes:</strong> ${props["KA Crashes"]}<br>
          <strong>Begin MP:</strong> ${props.BeginMP}<br>
          <strong>End MP:</strong> ${props.EndMP}
        `;

        new maplibregl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(popupHTML)
          .addTo(map);
      } else if (joined) {
        const props = joined.properties;
        const routeName =
          props.RD_NAME?.trim() || props.ROUTE || "Unknown Route";

        const popupHTML = `
          <div>
            <strong>Route Name:</strong> ${routeName}<br>
            <div id="kabco-chart"></div>
          </div>
        `;

        new maplibregl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(popupHTML)
          .addTo(map);

        setTimeout(() => {
          addChart(props);
        }, 0);
      }
    });

    // Hover states
    ["hin-hitbox", "crashes", "joinedRoads-hitbox"].forEach((layerId) => {
      map.on("mouseenter", layerId, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", layerId, () => {
        map.getCanvas().style.cursor = "";
      });
    });

    timeSlider();
    createDropdown(crashData);
    createYearDropdown(crashData);
    createLegend();

    // Add zoom and rotation controls to the map.
    map.addControl(new maplibregl.NavigationControl());

    map.fitBounds(getBounds(crashData), {
      padding: 50,
      maxZoom: 14,
      linear: true,
    });
    filterBy(); // Trigger filtering and count update on initial load

    // turn off heat legend when zooming to its fully transparent zoom level
    map.on("zoom", () => {
      const zoom = map.getZoom();
      const heatLegend = document.getElementById("heatmap-legend");
      if (heatLegend) {
        heatLegend.classList.toggle("hidden", zoom >= 12.5);
      }
    });
  });

  let viewHUDTimeout;

  // define function to give zoom level, pitch and bearing when user changes view in any way
  function updateViewHUD() {
    const zoomIndicator = document.getElementById("zoom-indicator");
    const zoom = map.getZoom().toFixed(1);
    const bearing = map.getBearing().toFixed(0); // azimuth in degrees
    const pitch = map.getPitch().toFixed(0); // viewing angle

    zoomIndicator.innerHTML = `
      Zoom: ${zoom}<br>
      Bearing: ${bearing}°<br>
      Pitch: ${pitch}°
    `;
    zoomIndicator.style.opacity = "1";

    if (viewHUDTimeout) clearTimeout(viewHUDTimeout);
    viewHUDTimeout = setTimeout(() => {
      zoomIndicator.style.opacity = "0";
    }, 1500);
  }

  // Trigger on zoom, rotate, or pitch change
  map.on("zoom", updateViewHUD);
  map.on("rotate", updateViewHUD);
  map.on("pitch", updateViewHUD);
}

// add chart to popup function
function addChart(props) {
  const data = [
    { id: "K", value: +props.K_sum || 0 },
    { id: "A", value: +props.A_sum || 0 },
    { id: "B", value: +props.B_sum || 0 },
    { id: "C", value: +props.C_sum || 0 },
    { id: "O", value: +props.O_sum || 0 },
  ];

  const total = data.reduce((sum, d) => sum + d.value, 0);

  const kabcoMap = kabcoVals.reduce((acc, k) => {
    acc[k.id] = { color: k.color, label: k.text };
    return acc;
  }, {});

  const width = 200;
  const height = 120;
  const margin = { top: 20, right: 5, bottom: 20, left: 5 };

  d3.select("#kabco-chart").selectAll("*").remove();
  const svg = d3
    .select("#kabco-chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  if (total === 0) {
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .attr("font-size", "14px")
      .attr("fill", "#444")
      .style("paint-order", "stroke")
      .style("stroke", "#fff")
      .style("stroke-width", "2px")
      .text("No Crashes on Segment");
    return;
  }

  // Total label
  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", 12)
    .attr("text-anchor", "middle")
    .attr("font-size", "12px")
    .attr("fill", "#000")
    .style("paint-order", "stroke")
    .style("stroke", "rgba(255, 255, 255, 0.75)")
    .style("stroke-width", "2px")
    .text(`${total} Total Crashes on Segment`);

  const x = d3
    .scaleBand()
    .domain(data.map((d) => d.id))
    .range([margin.left, width - margin.right])
    .padding(0.1);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.value) || 1])
    .range([height - margin.bottom, margin.top]);

  svg.append("defs").append("filter").attr("id", "bar-shadow").html(`
      <feDropShadow dx="2" dy="2" flood-color="#000" flood-opacity="0.25"/>
    `);

  svg
    .selectAll("rect")
    .data(data)
    .enter()
    .append("rect")
    .attr("x", (d) => x(d.id))
    .attr("y", (d) => y(d.value))
    .attr("width", x.bandwidth())
    .attr("height", (d) => height - margin.bottom - y(d.value))
    .attr("fill", (d) => kabcoMap[d.id].color)
    .attr("filter", "url(#bar-shadow)");

  svg
    .selectAll("g.bar-label")
    .data(data)
    .enter()
    .append("g")
    .attr("class", "bar-label")
    .each(function (d) {
      const group = d3.select(this);
      const centerX = x(d.id) + x.bandwidth() / 2;
      const barHeight = height - margin.bottom - y(d.value);
      const labelY =
        d.value === 0
          ? height - margin.bottom - 4
          : barHeight < 12
          ? y(d.value) - 4
          : y(d.value) + barHeight / 2 + 4;

      group
        .append("text")
        .attr("x", centerX)
        .attr("y", labelY)
        .attr("text-anchor", "middle")
        .attr("font-size", "12px")
        .attr("fill", "#333")
        .style("paint-order", "stroke")
        .style("stroke", "#fff")
        .style("stroke-width", "2px")
        .text(d.value);
    });
}

// filter function for all our filtering in map
function filterBy() {
  const filters = [];

  const timeRange =
    currentTimeIndex === 0 ? null : timeGroups[currentTimeIndex].range;

  const categories = kabcoVals.filter((k) => k.checked).map((k) => k.id);

  // If nothing is checked, apply a filter that excludes all features
  if (categories.length === 0) {
    map.setFilter("crashes", ["==", ["get", "KABCO"], "__NONE__"]);
    map.setFilter("heatLayer", ["==", ["get", "KABCO"], "__NONE__"]);
    currentFilteredData = [];
    updateCrashLegend();
    return;
  }

  if (timeRange) {
    filters.push([">=", ["to-number", ["get", "CollisionTime"]], timeRange[0]]);
    filters.push(["<=", ["to-number", ["get", "CollisionTime"]], timeRange[1]]);
  }
  if (categories.length > 0) {
    filters.push(["in", ["get", "KABCO"], ["literal", categories]]);
  }
  if (currentManner && currentManner !== "All") {
    filters.push(["==", ["get", "MannerofCollision"], currentManner]);
  }

  if (currentYear && currentYear !== "All") {
    filters.push(["==", ["slice", ["get", "CollisionDate"], -4], currentYear]);
  }

  const combined = ["all", ...filters];
  map.setFilter("crashes", combined);
  map.setFilter("heatLayer", combined);

  // Manually simulate filter to count features
  const allFeatures = crashData.features;

  currentFilteredData = allFeatures.filter((f) => {
    const props = f.properties;
    const time = parseInt(props.CollisionTime);
    const severity = props.KABCO;
    const manner = props.MannerofCollision?.trim();

    const inTime = !timeRange || (time >= timeRange[0] && time <= timeRange[1]);
    const inSeverity = categories.includes(severity);
    const inManner =
      !currentManner || currentManner === "All" || manner === currentManner;

    const inYear =
      !currentYear ||
      currentYear === "All" ||
      props.CollisionDate?.slice(-4) === currentYear;

    return inTime && inSeverity && inManner && inYear;
  });

  updateCrashLegend();
}

// update the legend with user interaction
function updateCrashLegend() {
  kabcoVals.forEach((prop) => {
    const count = currentFilteredData.filter(
      (f) => f.properties.KABCO === prop.id
    ).length;

    const countElem = document.getElementById(`count-${prop.id}`);
    if (countElem) {
      countElem.textContent = `(${count.toLocaleString()})`; // static update
    }
  });
}

// animate the counting of KABCO totals in legend
// dynamic with the features shown in the map
function animateCount(element, start, end, duration = 300) {
  let startTime = null;

  // Easing function (easeOutQuad)
  function easeOutQuad(t) {
    return t * (2 - t);
  }

  function animate(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;
    const progress = Math.min(elapsed / duration, 1); // cap at 1
    const eased = easeOutQuad(progress);
    const current = Math.floor(start + (end - start) * eased);

    element.textContent = `(${current.toLocaleString()})`;

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }

  // Fade in effect
  element.classList.remove("show");
  element.classList.add("fade-in");
  requestAnimationFrame(() => {
    element.classList.add("show");
    requestAnimationFrame(animate);
  });
}

// Time slider setup
function timeSlider() {
  const slider = document.querySelector(".slider-range");
  const label = document.querySelector(".slider-label");

  slider.setAttribute("max", timeGroups.length - 1);
  slider.value = 0;
  label.textContent = "All Crashes";

  slider.addEventListener("input", () => {
    currentTimeIndex = parseInt(slider.value);
    if (currentTimeIndex === 0) {
      label.textContent = "All Crashes";
    } else {
      label.textContent = timeGroups[currentTimeIndex].label;
    }
    filterBy(); // use global state
  });
}

// create legend function
function createLegend() {
  const legendDiv = document.getElementById("legend");

  kabcoVals.forEach((item) => {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = `kabco-${item.id}`;
    checkbox.checked = item.checked;
    checkbox.dataset.kabco = item.id;

    // Create circular symbol swatch
    const swatchWrapper = document.createElement("div");
    swatchWrapper.className = "legend-swatch-wrapper";

    const swatch = document.createElement("span");
    swatch.className = "legend-swatch-kabco";
    swatch.style.width = `${item.size * 2}px`;
    swatch.style.height = `${item.size * 2}px`;
    swatch.style.backgroundColor = item.color;

    swatchWrapper.appendChild(swatch);

    // Create label
    const label = document.createElement("label");
    label.htmlFor = checkbox.id;
    label.className = "legend-text";
    label.style.color = item.color;
    label.style.display = "flex";
    label.style.alignItems = "center";
    label.style.gap = "6px"; // spacing between swatch and text

    const countSpan = document.createElement("span");
    countSpan.id = `count-${item.id}`;
    countSpan.style.marginLeft = "6px";
    countSpan.textContent = "(0)";

    const labelText = document.createElement("span");
    labelText.textContent = item.text;

    // Assemble
    label.appendChild(swatchWrapper);
    label.appendChild(labelText);
    label.appendChild(countSpan);

    const wrapper = document.createElement("div");
    wrapper.className = "legend-item";
    wrapper.appendChild(checkbox);
    wrapper.appendChild(label);

    legendDiv.appendChild(wrapper);

    checkbox.addEventListener("change", () => {
      const val = checkbox.dataset.kabco;
      const entry = kabcoVals.find((k) => k.id === val);
      if (entry) entry.checked = checkbox.checked;

      const timeIndex = document.querySelector(".slider-range")?.value || 0;
      const timeRange = timeIndex == 0 ? null : timeGroups[timeIndex].range;
      const selectedManner =
        document.querySelector("#collision-dropdown")?.value || null;

      const shouldAnimate = checkbox.checked;
      filterBy(); // refresh counts

      if (shouldAnimate) {
        const count = currentFilteredData.filter(
          (f) => f.properties.KABCO === val
        ).length;
        const countElem = document.getElementById(`count-${val}`);
        if (countElem) {
          animateCount(countElem, 0, count, 400, true);
        }
      }
    });
  });

  // HIN toggle
  const hinCheckbox = document.createElement("input");
  hinCheckbox.type = "checkbox";
  hinCheckbox.id = "toggle-hin";
  hinCheckbox.checked = true;

  const hinLabel = document.createElement("label");
  hinLabel.htmlFor = "toggle-hin";
  hinLabel.className = "legend-text";
  hinLabel.innerHTML = `<span class="legend-swatch-hin"></span>High Injury Network`;

  const hinWrapper = document.createElement("div");
  hinWrapper.className = "legend-item";
  hinWrapper.appendChild(hinCheckbox);
  hinWrapper.appendChild(hinLabel);
  legendDiv.appendChild(hinWrapper);

  hinCheckbox.addEventListener("change", () => {
    const vis = hinCheckbox.checked ? "visible" : "none";
    ["hin-core", "hin-glow-mid", "hin-glow-outer", "hin-hitbox"].forEach((id) =>
      map.setLayoutProperty(id, "visibility", vis)
    );
  });
}

// Dropdown filter for manner of collision
function createDropdown(data) {
  const uniqueValues = Array.from(
    new Set(
      data.features
        .map((f) => f.properties.MannerofCollision?.trim())
        .filter((val) => val && val.length > 0)
    )
  ).sort();

  const dropdown = document.createElement("select");
  dropdown.id = "collision-dropdown";
  dropdown.style.margin = "10px";

  const allOption = document.createElement("option");
  allOption.value = "All";
  allOption.textContent = "All Collisions";
  dropdown.appendChild(allOption);

  uniqueValues.forEach((val) => {
    const option = document.createElement("option");
    option.value = val;
    option.textContent = val;
    dropdown.appendChild(option);
  });

  document.getElementById("collision-dropdown").replaceWith(dropdown);

  // test accessing dropdown values
  console.log("Dropdown values: ", uniqueValues);

  dropdown.addEventListener("change", () => {
    currentManner = dropdown.value;
    filterBy(); // use global state
  });
}

// dropdown filter by year
function createYearDropdown(data) {
  const uniqueYears = Array.from(
    new Set(
      data.features
        .map((f) => f.properties.CollisionDate?.trim().slice(-4))
        .filter((val) => /^\d{4}$/.test(val)) // only valid years
    )
  ).sort();

  const dropdown = document.createElement("select");
  dropdown.id = "year-dropdown";
  dropdown.style.margin = "10px";

  const allOption = document.createElement("option");
  allOption.value = "All";
  allOption.textContent = "All Years";
  dropdown.appendChild(allOption);

  uniqueYears.forEach((year) => {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    dropdown.appendChild(option);
  });

  document.getElementById("year-dropdown").replaceWith(dropdown);

  dropdown.addEventListener("change", () => {
    currentYear = dropdown.value;
    filterBy(); // re-filter
  });
}

// Load the data and initialize functions
loadData();
