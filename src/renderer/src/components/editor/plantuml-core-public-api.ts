declare module '@plantuml/core/plantuml.js' {
  export type PlantUmlRenderOptions = { dark?: boolean }

  export type PlantUmlModule = {
    render: (lines: string[], targetId: string, options?: PlantUmlRenderOptions) => void
  }

  export function render(lines: string[], targetId: string, options?: PlantUmlRenderOptions): void
}
