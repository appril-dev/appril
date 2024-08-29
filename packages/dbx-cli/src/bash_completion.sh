#!/usr/bin/env bash

function _appril_dbx_cli() {

  local cur prev opts

  COMPREPLY=()

  cur="${COMP_WORDS[COMP_CWORD]}"
  prev="${COMP_WORDS[COMP_CWORD - 1]}"
  opts="-c -g -m"

  case "${prev}" in
    -c)
      opts=$(ls dbx.*.ts)
      ;;
    -m)
      opts="create up down latest rollback list unlock version compile"
      ;;
    rollback)
      opts="--all"
      ;;
    *) ;;
  esac

  COMPREPLY=($(compgen -W "$opts" -- $cur))
  return 0

}

complete -F _appril_dbx_cli dbx
