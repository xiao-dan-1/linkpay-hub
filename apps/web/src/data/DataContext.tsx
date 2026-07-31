import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import type { PropsWithChildren } from 'react'
import { PrototypeRepository } from './repository'

const repository = new PrototypeRepository()

type DataContextValue = {
  repository: PrototypeRepository
  version: number
  refresh: () => void
}

const DataContext = createContext<DataContextValue>({
  repository,
  version: 0,
  refresh: () => undefined,
})

export function DataProvider({ children }: PropsWithChildren) {
  const [version, setVersion] = useState(0)
  const refresh = useCallback(() => setVersion((value) => value + 1), [])
  const value = useMemo(
    () => ({ repository, version, refresh }),
    [version, refresh],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  return useContext(DataContext)
}
