package main

import (
	"log"
)

func main() {
	processor := &MockAudioProcessor{}
	log.Fatal(processor.StartMockServer(8080))
}
