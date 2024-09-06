#!/usr/bin/env bash

function _dbxt_migrate() {

  local \
    curr \
    prev \
    opts \
    ;

  COMPREPLY=()

  curr="${COMP_WORDS[COMP_CWORD]}"
  prev="${COMP_WORDS[COMP_CWORD - 1]}"
  opts="create up down latest rollback list unlock version build"

  case "${prev}" in
    up | down)
      opts="--select"
      ;;
    rollback)
      opts="--all"
      ;;
    build)
      opts="--dir"
      ;;
    -d | --dir)
      opts="$(find -mindepth 1 -maxdepth 1 -type d -printf '%p ')"
      ;;
    *) ;;
  esac

  COMPREPLY=($(compgen -W "$opts" -- $curr))
  return 0

}

complete -F _dbxt_migrate db-migrate
