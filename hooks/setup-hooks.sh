#!/bin/bash

# Diretório de hooks do Git
GIT_HOOKS_DIR=".git/hooks"

# Diretório onde os hooks estão armazenados
HOOKS_DIR="hooks"

# Copia os hooks para o diretório de hooks do Git
cp $HOOKS_DIR/* $GIT_HOOKS_DIR/

echo "Hooks configurados com sucesso."