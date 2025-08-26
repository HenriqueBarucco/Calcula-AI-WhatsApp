export interface AddState {
  step: 'NAME' | 'VALUE' | 'QUANTITY'
  name?: string
  value?: number
  quantity?: number
}
