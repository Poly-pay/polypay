BUILD_DIR := ./build
SETUP_DIR := ./setup

all: setup

$(BUILD_DIR)/pot12_0000.ptau:
	@ mkdir -p $(BUILD_DIR)
	snarkjs powersoftau new bn128 12 $(BUILD_DIR)/pot12_0000.ptau

$(BUILD_DIR)/pot12_0001.ptau: $(BUILD_DIR)/pot12_0000.ptau
	snarkjs powersoftau contribute $(BUILD_DIR)/pot12_0000.ptau $(BUILD_DIR)/pot12_0001.ptau --name="First contribution"

$(BUILD_DIR)/pot12_beacon.ptau: $(BUILD_DIR)/pot12_0001.ptau
	snarkjs powersoftau beacon $(BUILD_DIR)/pot12_0001.ptau $(BUILD_DIR)/pot12_beacon.ptau 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon"

$(BUILD_DIR)/pot12_final.ptau: $(BUILD_DIR)/pot12_beacon.ptau
	snarkjs powersoftau prepare phase2 $(BUILD_DIR)/pot12_beacon.ptau $(BUILD_DIR)/pot12_final.ptau

$(BUILD_DIR)/circuit.r1cs: circuit.circom
	@ mkdir -p $(BUILD_DIR)
	circom --inspect -p bn128 -o $(BUILD_DIR) --r1cs circuit.circom

$(BUILD_DIR)/circuit.wasm: circuit.circom
	@ mkdir -p $(BUILD_DIR)
	circom --inspect -p bn128 -o $(BUILD_DIR) --wasm --sym circuit.circom; mv $(BUILD_DIR)/circuit_js/circuit.wasm $(BUILD_DIR)/

$(BUILD_DIR)/circuit_0000.zkey: $(BUILD_DIR)/circuit.r1cs $(BUILD_DIR)/pot12_final.ptau
	snarkjs groth16 setup $(BUILD_DIR)/circuit.r1cs $(BUILD_DIR)/pot12_final.ptau $(BUILD_DIR)/circuit_0000.zkey

$(BUILD_DIR)/circuit_0001.zkey: $(BUILD_DIR)/circuit_0000.zkey
	snarkjs zkey contribute $(BUILD_DIR)/circuit_0000.zkey $(BUILD_DIR)/circuit_0001.zkey --name="1st Contributor Name"

$(BUILD_DIR)/circuit_final.zkey: $(BUILD_DIR)/circuit_0001.zkey
	snarkjs zkey beacon $(BUILD_DIR)/circuit_0001.zkey $(BUILD_DIR)/circuit_final.zkey 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon phase2"

$(BUILD_DIR)/verification_key.json: $(BUILD_DIR)/circuit_final.zkey
	snarkjs zkey export verificationkey $(BUILD_DIR)/circuit_final.zkey $(BUILD_DIR)/verification_key.json

$(SETUP_DIR)/circuit_final.zkey: $(BUILD_DIR)/circuit_final.zkey
	@ mkdir -p $(SETUP_DIR)
	cp $(BUILD_DIR)/circuit_final.zkey $(SETUP_DIR)

$(SETUP_DIR)/circuit.wasm: $(BUILD_DIR)/circuit.wasm
	@ mkdir -p $(SETUP_DIR)
	cp $(BUILD_DIR)/circuit.wasm $(SETUP_DIR)

$(SETUP_DIR)/verification_key.json: $(BUILD_DIR)/verification_key.json
	@ mkdir -p $(SETUP_DIR)
	cp $(BUILD_DIR)/verification_key.json $(SETUP_DIR)

setup: $(SETUP_DIR)/circuit_final.zkey $(SETUP_DIR)/circuit.wasm $(SETUP_DIR)/verification_key.json

clean:
	rm -rf $(BUILD_DIR)

dist-clean: clean
	rm -rf $(SETUP_DIR)

.PHONY: all setup clean dist-clean
