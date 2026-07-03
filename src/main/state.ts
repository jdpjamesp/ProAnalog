let ingestionInProgress = false

export function isIngestionInProgress(): boolean {
  return ingestionInProgress
}

export function setIngestionInProgress(value: boolean): void {
  ingestionInProgress = value
}
