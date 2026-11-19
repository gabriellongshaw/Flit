const world = (id, name, price, scenery, seed, hills, day, night) => ({ id: `world:${id}`, name, price, scenery, seed, hills, day, night });

const colours = (skyTop, skyBottom, sun, cloud, far, mid, ground, groundLine, dust) => ({ skyTop, skyBottom, sun, cloud, far, mid, ground, groundLine, dust });

export const WORLDS = [
  world('sunset', 'Sunset', 0, 'city', 7, [34, 18, 10, 0.006, 0.013],
    colours('#ffcfa3', '#fff6ee', '#fff7ed', 'rgba(255,255,255,0.85)', '#ffd9b8', '#f8b48a', '#2a1410', '#fb923c', '#ffe8d4'),
    colours('#1a0f14', '#4a2133', '#ffe4d1', 'rgba(251,146,60,0.12)', '#2a1520', '#3a1d2b', '#0f070a', '#f26a2e', '#fdba74')),
  world('meadow', 'Meadow', 80, 'dunes', 11, [30, 20, 9, 0.005, 0.012],
    colours('#bfe9ff', '#f1fbff', '#ffffff', 'rgba(255,255,255,0.9)', '#b9e4c4', '#8fd19e', '#16301c', '#4ade80', '#eafff0'),
    colours('#09131f', '#14304a', '#e0f2fe', 'rgba(125,211,252,0.12)', '#112a24', '#173a2c', '#08140d', '#22c55e', '#86efac')),
  world('ocean', 'Ocean', 100, 'dunes', 17, [26, 16, 8, 0.004, 0.011],
    colours('#a5e3ff', '#eefaff', '#ffffff', 'rgba(255,255,255,0.88)', '#a9d8f2', '#6fbbe6', '#0f2740', '#38bdf8', '#e0f4ff'),
    colours('#050d1c', '#0f2a4d', '#dbeafe', 'rgba(125,211,252,0.12)', '#0d2340', '#12315a', '#040a14', '#2f8fe0', '#7dd3fc')),
  world('desert', 'Desert', 120, 'dunes', 21, [30, 14, 8, 0.004, 0.009],
    colours('#fcd9a8', '#fff4e0', '#fffaf0', 'rgba(255,255,255,0.8)', '#f2c78f', '#e5a65f', '#3a2414', '#f59e0b', '#fff1d6'),
    colours('#140d1f', '#3b2540', '#fff3d6', 'rgba(253,186,116,0.1)', '#2e1f2e', '#44292f', '#140a0a', '#d97706', '#fdba74')),
  world('arctic', 'Arctic', 140, 'peaks', 29, [24, 14, 8, 0.005, 0.011],
    colours('#cdeaff', '#f7fcff', '#ffffff', 'rgba(255,255,255,0.9)', '#d6e8f5', '#b3d4ec', '#1b2c3d', '#93c5fd', '#ffffff'),
    colours('#060d1a', '#173257', '#e0f2fe', 'rgba(147,197,253,0.12)', '#14284a', '#1c3a63', '#050b14', '#60a5fa', '#bfdbfe')),
  world('candy', 'Candy', 160, 'city', 33, [30, 16, 9, 0.006, 0.014],
    colours('#ffc9e6', '#fff1f8', '#ffffff', 'rgba(255,255,255,0.88)', '#ffd1ea', '#f9a8d4', '#3b1530', '#f472b6', '#ffe4f3'),
    colours('#1b0b1f', '#4a1f4d', '#fce7f3', 'rgba(244,114,182,0.12)', '#32173a', '#481f50', '#12061a', '#e84fb0', '#f9a8d4')),
  world('volcano', 'Volcano', 180, 'peaks', 41, [28, 16, 9, 0.005, 0.012],
    colours('#fbb6a0', '#ffe9e0', '#fff1ea', 'rgba(255,255,255,0.75)', '#e59a86', '#c96a58', '#2a1210', '#f97316', '#ffd9cc'),
    colours('#150808', '#4a1512', '#ffd7c2', 'rgba(239,68,68,0.1)', '#2b0f0e', '#4a1a15', '#0d0404', '#ef4444', '#fb923c')),
  world('twilight', 'Twilight', 200, 'city', 47, [32, 18, 10, 0.006, 0.013],
    colours('#d9ccff', '#f6f1ff', '#ffffff', 'rgba(255,255,255,0.88)', '#d6c8f5', '#b8a3ea', '#1f1838', '#a78bfa', '#f0eaff'),
    colours('#0a0818', '#271c4d', '#ede9fe', 'rgba(167,139,250,0.12)', '#1d1640', '#2d2160', '#07050f', '#8b5cf6', '#c4b5fd'))
];