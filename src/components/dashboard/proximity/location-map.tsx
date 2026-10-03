"use client"

import { useEffect, useRef } from "react"
import type { Circle, Map as LeafletMap, Marker } from "leaflet"
import "leaflet/dist/leaflet.css"

/** Roughly where iOS considers the customer "near" a pass location. */
const RELEVANCE_RADIUS_M = 100
const ZOOM = 17

type LocationMapProps = {
  latitude: number
  longitude: number
  /** Called when the merchant drags the pin to fix the exact spot. */
  onMove: (latitude: number, longitude: number) => void
  ariaLabel: string
}

/**
 * Location preview with a draggable pin and the ~100 m relevance circle.
 * Leaflet + OpenStreetMap tiles (no key). Leaflet touches `window`, so it's
 * imported inside the effect; the pin is a CSS dot (divIcon) — Leaflet's
 * default marker images don't resolve through the bundler.
 */
export function LocationMap({ latitude, longitude, onMove, ariaLabel }: LocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const circleRef = useRef<Circle | null>(null)
  // Latest callback without re-creating the map when the parent re-renders.
  const onMoveRef = useRef(onMove)
  useEffect(() => {
    onMoveRef.current = onMove
  }, [onMove])

  // Create the map once.
  useEffect(() => {
    let cancelled = false
    let map: LeafletMap | null = null
    void import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return
      map = L.map(containerRef.current, { zoomControl: true, attributionControl: true }).setView(
        [latitude, longitude],
        ZOOM,
      )
      // OpenStreetMap's attribution is required; Leaflet's own prefix stays plain.
      map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>')
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map)

      // Leaflet writes colors as SVG attributes, where CSS variables don't
      // resolve; a class sets them as CSS properties, which win.
      const circle = L.circle([latitude, longitude], {
        radius: RELEVANCE_RADIUS_M,
        weight: 2,
        fillOpacity: 0.12,
        className: "[stroke:var(--chart-1)] [fill:var(--chart-1)]",
      }).addTo(map)

      const marker = L.marker([latitude, longitude], {
        draggable: true,
        autoPan: true,
        keyboard: false,
        icon: L.divIcon({
          className: "",
          html: '<span style="display:block;width:18px;height:18px;border-radius:9999px;background:var(--chart-1);border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></span>',
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
      }).addTo(map)
      marker.on("drag", () => circle.setLatLng(marker.getLatLng()))
      marker.on("dragend", () => {
        const { lat, lng } = marker.getLatLng()
        onMoveRef.current(lat, lng)
      })

      mapRef.current = map
      markerRef.current = marker
      circleRef.current = circle
    })
    return () => {
      cancelled = true
      map?.remove()
      mapRef.current = null
      markerRef.current = null
      circleRef.current = null
    }
    // Created once; position changes are applied by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A new address from the autocomplete (or a drag) moves pin, circle and view.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const target: [number, number] = [latitude, longitude]
    markerRef.current?.setLatLng(target)
    circleRef.current?.setLatLng(target)
    if (!map.getBounds().pad(-0.2).contains(target)) map.setView(target, map.getZoom())
  }, [latitude, longitude])

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label={ariaLabel}
      className="relative z-0 h-56 w-full overflow-hidden rounded-lg border border-border"
    />
  )
}
