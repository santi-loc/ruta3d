"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";

type StoreMapLocation = {
  address: string;
  area: string;
  lat: number;
  lng: number;
  name: string;
  url: string;
};

type PostalCodeCenter = {
  label: string;
  lat: number;
  lng: number;
  zoom: number;
};

type StoreMapProps = {
  physicalStores: StoreMapLocation[];
  onSelectStore: (store: string) => void;
};

const argentinaCenter: PostalCodeCenter = { label: "Argentina", lat: -38.4161, lng: -63.6167, zoom: 4 };
const ambaCenter: PostalCodeCenter = { label: "AMBA", lat: -34.6132, lng: -58.4333, zoom: 11 };
const cordobaCenter: PostalCodeCenter = { label: "Córdoba", lat: -31.4167, lng: -64.1833, zoom: 12 };
const santaFeCenter: PostalCodeCenter = { label: "Santa Fe", lat: -31.6333, lng: -60.7000, zoom: 12 };
const mapMinZoom = 4;
const mapMaxZoom = 18;
const mapZoomStep = 0.25;
const storeAreaReferencePostalCodes: Record<string, number> = {
  "CABA": 1416,
  "La Plata": 1900,
  "Córdoba": 5000,
};

const postalCodeCenters: Array<{ test: (code: number) => boolean } & PostalCodeCenter> = [
  { test: (code) => code >= 1000 && code <= 1499, label: "CABA", lat: -34.6037, lng: -58.3816, zoom: 13 },
  { test: (code) => code >= 1600 && code <= 1899, label: "AMBA", lat: -34.6037, lng: -58.521, zoom: 11 },
  { test: (code) => code >= 1900 && code <= 1925, label: "La Plata", lat: -34.9205, lng: -57.9536, zoom: 12 },
  { test: (code) => code >= 2000 && code <= 2199, label: "Rosario", lat: -32.9442, lng: -60.6505, zoom: 11 },
  { test: (code) => code >= 3000 && code <= 3199, label: "Santa Fe / Paraná", lat: -31.63, lng: -60.72, zoom: 10 },
  { test: (code) => code >= 4000 && code <= 4199, label: "Tucumán", lat: -26.8241, lng: -65.2226, zoom: 10 },
  { test: (code) => code >= 4400 && code <= 4599, label: "Salta / Jujuy", lat: -24.79, lng: -65.41, zoom: 9 },
  { test: (code) => code >= 5000 && code <= 5199, label: "Córdoba", lat: -31.4167, lng: -64.1833, zoom: 12 },
  { test: (code) => code >= 5500 && code <= 5599, label: "Mendoza", lat: -32.8895, lng: -68.8458, zoom: 11 },
  { test: (code) => code >= 5700 && code <= 5899, label: "San Luis / Río Cuarto", lat: -33.17, lng: -65.05, zoom: 8 },
  { test: (code) => code >= 6000 && code <= 6499, label: "Buenos Aires interior / La Pampa", lat: -35.66, lng: -63.76, zoom: 7 },
  { test: (code) => code >= 7000 && code <= 7699, label: "Buenos Aires sur", lat: -37.32, lng: -59.13, zoom: 7 },
  { test: (code) => code >= 8000 && code <= 8299, label: "Bahía Blanca", lat: -38.7183, lng: -62.2663, zoom: 9 },
  { test: (code) => code >= 8300 && code <= 8499, label: "Neuquén / Río Negro", lat: -39.1, lng: -68.0, zoom: 7 },
  { test: (code) => code >= 9000 && code <= 9399, label: "Chubut", lat: -43.3, lng: -65.1, zoom: 7 },
  { test: (code) => code >= 9400 && code <= 9499, label: "Santa Cruz", lat: -51.62, lng: -69.22, zoom: 7 },
];

function postalCenterFor(value: string): PostalCodeCenter | null {
  const code = postalCodeNumber(value);
  if (code === null) return null;

  return postalCodeCenters.find((center) => center.test(code)) ?? null;
}

function postalCodeNumber(value: string): number | null {
  const code = Number(value.replace(/\D/g, "").slice(0, 4));
  return Number.isFinite(code) && code >= 1000 ? code : null;
}

function directStoreAreasFor(center: PostalCodeCenter) {
  if (center.label === "AMBA") return ["CABA"];
  if (center.label in storeAreaReferencePostalCodes) return [center.label];
  return [];
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };
    return entities[character];
  });
}

export function StoreMap({ physicalStores, onSelectStore }: StoreMapProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerLayerRef = useRef<{ remove: () => void } | null>(null);
  const markersRef = useRef<LeafletMarker[]>([]);
  const [postalCode, setPostalCode] = useState("");
  const [postalMessage, setPostalMessage] = useState("Ingresá tu código postal para acercarte a tu zona.");
  const [nearestStores, setNearestStores] = useState<StoreMapLocation[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(argentinaCenter.zoom);

  const storeBounds = useMemo(
    () => physicalStores.map((store) => [store.lat, store.lng] as [number, number]),
    [physicalStores],
  );

  useEffect(() => {
    let cancelled = false;

    async function createMap() {
      if (!mapElementRef.current || mapRef.current) return;

      const L = await import("leaflet");
      if (cancelled || !mapElementRef.current) return;

      const map = L.map(mapElementRef.current, {
        bounceAtZoomLimits: false,
        center: [argentinaCenter.lat, argentinaCenter.lng],
        inertia: true,
        inertiaDeceleration: 2600,
        inertiaMaxSpeed: 1600,
        maxBounds: [[-56.5, -76.5], [-20, -50]],
        maxBoundsViscosity: 0.7,
        markerZoomAnimation: true,
        minZoom: mapMinZoom,
        preferCanvas: true,
        wheelDebounceTime: 16,
        scrollWheelZoom: true,
        wheelPxPerZoomLevel: 28,
        zoom: argentinaCenter.zoom,
        zoomAnimation: true,
        zoomControl: true,
        zoomDelta: 2.5,
        zoomSnap: mapZoomStep,
      });

      map.on("zoomend", () => {
        setCurrentZoom(Number(map.getZoom().toFixed(2)));
      });

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        updateWhenIdle: true,
        updateWhenZooming: false,
      }).addTo(map);

      mapRef.current = map;
      setMapReady(true);
    }

    void createMap();

    return () => {
      cancelled = true;
      markerLayerRef.current?.remove();
      mapRef.current?.remove();
      markerLayerRef.current = null;
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    let cancelled = false;

    async function renderMarkers() {
      const L = await import("leaflet");
      if (cancelled || !mapRef.current) return;

      markerLayerRef.current?.remove();
      markersRef.current = [];

      const layer = L.layerGroup().addTo(mapRef.current);
      markerLayerRef.current = layer;

      for (const store of physicalStores) {
        const marker = L.marker([store.lat, store.lng], {
          icon: L.divIcon({
            className: "osm-store-marker",
            html: `<span>${escapeHtml(store.name)}</span>`,
            iconAnchor: [18, 42],
            iconSize: [36, 42],
          }),
          title: `${store.name} - ${store.area}`,
        })
          .addTo(layer)
          .bindPopup(`<strong>${escapeHtml(store.name)}</strong><br>${escapeHtml(store.address)}`);

        marker.on("click", () => {
          mapRef.current?.setView([store.lat, store.lng], 15, { animate: true });
          onSelectStore(store.name);
        });

        markersRef.current.push(marker);
      }

      if (storeBounds.length > 0) {
        mapRef.current.fitBounds(storeBounds, { maxZoom: 12, padding: [48, 48] });
      }
    }

    void renderMarkers();

    return () => {
      cancelled = true;
    };
  }, [mapReady, onSelectStore, physicalStores, storeBounds]);

  function moveTo(center: PostalCodeCenter) {
    mapRef.current?.setView([center.lat, center.lng], center.zoom, { animate: true });
  }

  function closestStoresFor(code: number) {
    const uniqueStores = new Map<string, StoreMapLocation>();

    const rankedStores = physicalStores
      .map((store) => ({
        distance: Math.abs((storeAreaReferencePostalCodes[store.area] ?? Number.POSITIVE_INFINITY) - code),
        store,
      }))
      .sort((a, b) => a.distance - b.distance || a.store.name.localeCompare(b.store.name, "es"));

    for (const { store } of rankedStores) {
      if (!uniqueStores.has(store.name)) uniqueStores.set(store.name, store);
    }

    return [...uniqueStores.values()].slice(0, 3);
  }

  function showNearestStores(code: number, message: string) {
    const closestStores = closestStoresFor(code);
    setNearestStores(closestStores);
    setPostalMessage(message);

    if (closestStores.length > 0) {
      mapRef.current?.fitBounds(closestStores.map((store) => [store.lat, store.lng] as [number, number]), {
        animate: true,
        maxZoom: 11,
        padding: [56, 56],
      });
    }
  }

  function selectNearestStore(store: StoreMapLocation) {
    mapRef.current?.setView([store.lat, store.lng], 15, { animate: true });
    onSelectStore(store.name);
  }

  function setZoom(nextZoom: number) {
    const boundedZoom = Math.min(mapMaxZoom, Math.max(mapMinZoom, nextZoom));
    setCurrentZoom(boundedZoom);
    mapRef.current?.setZoom(boundedZoom, { animate: false });
  }

  function handlePostalSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = postalCodeNumber(postalCode);
    const center = postalCenterFor(postalCode);

    if (!code) {
      setNearestStores([]);
      setPostalMessage("No pude ubicar ese CP todavía. Probá con 1414, 1900, 3000 o 5000.");
      moveTo(argentinaCenter);
      return;
    }

    if (!center) {
      showNearestStores(code, "No tenemos esa zona cargada todavía. Te muestro los locales conectados más cercanos.");
      return;
    }

    const directAreas = directStoreAreasFor(center);
    const hasNearbyStore = directAreas.length > 0 && physicalStores.some((store) => directAreas.includes(store.area));

    if (!hasNearbyStore) {
      showNearestStores(code, `No hay locales conectados cerca de ${center.label}. Te muestro los más cercanos.`);
      return;
    }

    setNearestStores([]);
    setPostalMessage(`Mapa centrado en ${center.label}.`);
    moveTo(center);
  }

  return (
    <div className="store-map-panel" aria-label="Mapa interactivo de tiendas con local">
      <div className="store-map-controls" aria-label="Controles del mapa">
        <button type="button" onClick={() => moveTo(argentinaCenter)}>Argentina</button>
        <button type="button" onClick={() => moveTo(ambaCenter)}>AMBA</button>
        <button type="button" onClick={() => moveTo(cordobaCenter)}>Córdoba</button>
        <button type="button" onClick={() => moveTo(santaFeCenter)}>Santa Fe</button>
      </div>

      <form className="store-map-search" onSubmit={handlePostalSearch}>
        <label htmlFor="store-map-postal-code">Tu código postal</label>
        <div className="store-map-search-fields">
          <input
            id="store-map-postal-code"
            inputMode="numeric"
            maxLength={8}
            onChange={(event) => setPostalCode(event.target.value)}
            placeholder="Ej: 1414"
            value={postalCode}
          />
          <button type="submit">Buscar</button>
        </div>
        <p>{postalMessage}</p>
        {nearestStores.length ? (
          <div className="store-map-nearest" aria-label="Locales más cercanos al código postal">
            <strong>Locales más cercanos</strong>
            <div>
              {nearestStores.map((store) => (
                <button key={`${store.name}-${store.address}`} type="button" onClick={() => selectNearestStore(store)}>
                  <span>{store.name}</span>
                  <small>{store.area}</small>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </form>

      <div className="store-map-viewport">
        <div ref={mapElementRef} className="store-map-leaflet" role="application" aria-label="Mapa con calles y locales de tiendas 3D" />
        <div className="store-map-zoom-slider" aria-label="Control de zoom del mapa">
          <label htmlFor="store-map-zoom">Zoom</label>
          <input
            id="store-map-zoom"
            max={mapMaxZoom}
            min={mapMinZoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            step={mapZoomStep}
            type="range"
            value={currentZoom}
          />
          <output htmlFor="store-map-zoom">{currentZoom.toFixed(currentZoom % 1 === 0 ? 0 : 2)}x</output>
        </div>
      </div>
    </div>
  );
}
