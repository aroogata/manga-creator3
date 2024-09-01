'use client'

import React, { useCallback, useRef, useState } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { useHotkeys } from 'react-hotkeys-hook'
import { create } from 'zustand'
import { Rnd } from 'react-rnd'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ImageIcon, TypeIcon, GripVertical } from 'lucide-react'

// Layer インターフェースの定義
interface Layer {
  id: number
  type: 'image' | 'text'
  src: string
  name: string
  width: number
  height: number
  x: number
  y: number
  zIndex: number
  content?: string
}

// EditorState インターフェースの定義
interface EditorState {
  layers: Layer[]
  selectedLayerId: number | null
  addLayer: (layer: Layer) => void
  updateLayer: (id: number, updates: Partial<Layer>) => void
  selectLayer: (id: number | null) => void
  reorderLayers: (startIndex: number, endIndex: number) => void
  deleteSelectedLayer: () => void
}

// Zustand ストアの作成
const useStore = create<EditorState>((set) => ({
  layers: [],
  selectedLayerId: null,
  addLayer: (layer) => set((state) => ({ 
    layers: [{ ...layer, zIndex: state.layers.length }, ...state.layers] 
  })),
  updateLayer: (id, updates) => set((state) => ({
    layers: state.layers.map((layer) => layer.id === id ? { ...layer, ...updates } : layer)
  })),
  selectLayer: (id) => set({ selectedLayerId: id }),
  reorderLayers: (startIndex, endIndex) => set((state) => {
    const newLayers = Array.from(state.layers)
    const [reorderedItem] = newLayers.splice(startIndex, 1)
    newLayers.splice(endIndex, 0, reorderedItem)
    return { 
      layers: newLayers.map((layer, index) => ({ ...layer, zIndex: newLayers.length - 1 - index }))
    }
  }),
  deleteSelectedLayer: () => set((state) => ({
    layers: state.layers.filter((layer) => layer.id !== state.selectedLayerId),
    selectedLayerId: null
  })),
}))

// LayerItem コンポーネントの定義（型アノテーションを追加）
const LayerItem = ({ layer, index }: { layer: Layer; index: number }) => {
  const selectedLayerId = useStore((state) => state.selectedLayerId)
  const selectLayer = useStore((state) => state.selectLayer)

  return (
    <Draggable draggableId={layer.id.toString()} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`flex items-center p-2 mb-2 rounded ${snapshot.isDragging ? 'opacity-50' : ''} ${layer.id === selectedLayerId ? 'bg-accent' : 'bg-card'}`}
          onClick={() => selectLayer(layer.id)}
        >
          <div {...provided.dragHandleProps} className="mr-2">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          {layer.type === 'image' ? (
            <ImageIcon className="mr-2 h-4 w-4" />
          ) : (
            <TypeIcon className="mr-2 h-4 w-4" />
          )}
          <span className="flex-grow text-sm">{layer.type === 'image' ? 'Image' : 'Text'}</span>
          {layer.type === 'image' && (
            <img src={layer.src} alt={layer.name} className="w-6 h-6 object-cover rounded" />
          )}
        </div>
      )}
    </Draggable>
  )
}

// ResizableImage コンポーネントの定義
const ResizableImage = ({ layer }: { layer: Layer }) => {
  const { updateLayer, selectLayer } = useStore()
  const selectedLayerId = useStore((state) => state.selectedLayerId)
  const isSelected = layer.id === selectedLayerId

  const handleSelect = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    selectLayer(layer.id)
  }, [layer.id, selectLayer])

  const handleDragStop = useCallback((_e: any, d: { x: number; y: number }) => {
    updateLayer(layer.id, { x: d.x, y: d.y })
  }, [layer.id, updateLayer])

  const handleResize = useCallback((_e: any, _direction: any, ref: { offsetWidth: number; offsetHeight: number }, _delta: any, position: { x: number; y: number }) => {
    updateLayer(layer.id, {
      width: ref.offsetWidth,
      height: ref.offsetHeight,
      x: position.x,
      y: position.y,
    })
  }, [layer.id, updateLayer])

  return (
    <Rnd
      size={{ width: layer.width, height: layer.height }}
      position={{ x: layer.x, y: layer.y }}
      onDragStop={handleDragStop}
      onResize={handleResize}
      onClick={handleSelect}
      bounds="parent"
      enableResizing={isSelected}
      disableDragging={!isSelected}
      style={{ zIndex: layer.zIndex }}
    >
      <div className="w-full h-full relative overflow-hidden">
        <img
          src={layer.src}
          alt={layer.name}
          className="w-full h-full object-cover"
        />
        {isSelected && (
          <div className="absolute inset-0 border-2 border-primary pointer-events-none" />
        )}
      </div>
    </Rnd>
  )
}

// メインコンポーネント
export default function Component() {
  const { layers, selectedLayerId, addLayer, selectLayer, deleteSelectedLayer, reorderLayers } = useStore()
  const [prompt, setPrompt] = useState('')
  const [size, setSize] = useState('square_hd')
  const [loading, setLoading] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, size }),
      })
      const data = await response.json()
      const newLayer: Layer = {
        id: Date.now(),
        type: 'image',
        src: data.images[0].url,
        name: `Generated Image ${layers.length + 1}`,
        width: 200,
        height: 200,
        x: 0,
        y: 0,
        zIndex: layers.length,
      }
      addLayer(newLayer)
    } catch (error) {
      console.error('Error generating image:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      selectLayer(null)
    }
  }, [selectLayer])

  const onDragEnd = useCallback((result: any) => {
    if (!result.destination) {
      return
    }

    reorderLayers(result.source.index, result.destination.index)
  }, [reorderLayers])

  useHotkeys('delete', deleteSelectedLayer, [deleteSelectedLayer])

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex h-screen bg-background text-foreground">
        <Card className="w-64 m-4">
          <CardHeader>
            <CardTitle>Layers</CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-13rem)]">
              <Droppable droppableId="layers">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="p-4">
                    {layers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No layers yet. Generate an image to get started.</p>
                    ) : (
                      layers.map((layer, index) => (
                        <LayerItem key={layer.id} layer={layer} index={index} />
                      ))
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="flex-1 p-4 overflow-hidden">
          <div ref={canvasRef} className="relative w-full h-full bg-accent" onClick={handleBackgroundClick}>
            {layers.map((layer) => (
              <ResizableImage key={layer.id} layer={layer} />
            ))}
          </div>
        </div>

        <Card className="w-80 m-4">
          <CardHeader>
            <CardTitle>Generate Image</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter your prompt here"
                required
              />
              <Select onValueChange={(value) => setSize(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select image size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="square_hd">Square HD</SelectItem>
                  <SelectItem value="portrait_4_3">Portrait 4:3</SelectItem>
                  <SelectItem value="portrait_16_9">Portrait 16:9</SelectItem>
                  <SelectItem value="landscape_4_3">Landscape 4:3</SelectItem>
                  <SelectItem value="landscape_16_9">Landscape 16:9</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Generating...' : 'Generate Image'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </DragDropContext>
  )
}