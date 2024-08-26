#!/usr/bin/env bash

set -e

unset -v \
  no_action \
  dbxfile \
  generate \
  migrate \
  migrate_args \
  distDir \
  next \
  node \
  ;

node="node --env-file=.env --enable-source-maps"

dbxfile="dbx.config.ts"

no_action="true"
generate=""
migrate=""
migrate_args=""
next=""

function dbx_run() {
  local d="$1"
  shift
  $node "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/$d/index.mjs" "$@"
}

function knex_run() {
  $node $(which pnpm) exec knex "$@"
}

function print_error() {
  echo
  echo -e "\e[31m✖\e[0m $*"
  echo
}

function print_success() {
  echo -e "\e[32m✔\e[0m $*"
}

function print_usage() {
  echo
  echo "Usage:"
  echo
  echo "  dbx [-c dbx.config.ts] [-g] [-w] [-m ...]"
  echo
  echo "  dbx -g                          : Run generators/plugins"
  echo
  echo "  dbx -w                          : Watch mode - run generators/plugins when config file updated"
  echo
  echo "  dbx -m create                   : Create a new migration file"
  echo
  echo "  dbx -m up|down|latest|rollback  : Run given migration task"
  echo
  echo "  dbx -m unlock                   : Forcibly unlocks the migrations lock table"
  echo
  echo "  dbx -m list                     : List all migrations files with status"
  echo
  echo "  dbx -m compile                  : Compile migration files without running any migration task"
  echo
  echo "  dbx                             : Run latest migrations and generate files"
  echo
}

PATH="$PATH:node_modules/.bin"

if ! command -v knex >/dev/null 2>&1; then
  print_error "knex not found, please install knex"
  echo -e "\t\$ pnpm add knex\n"
  exit 1
fi

distDir=$(node -e "process.stdout.write(require('./package.json').distDir || '')")

if [[ -z $distDir ]]; then
  print_error "package.json supposed to contain top-level distDir key"
  exit 1
fi

while getopts ":hgwc:m:" opt; do
  case ${opt} in
    c)
      dbxfile=$OPTARG
      ;;
    g)
      no_action="false"
      generate="once"
      ;;
    w)
      no_action="false"
      generate="watch"
      ;;
    m)
      no_action="false"
      # somehow if eval-ing directly into migrate_args it eats next opt
      eval "next=\${$OPTIND}"
      [[ $next =~ ^\-[a-zA-Z0-9]$ ]] || {
        migrate_args=$next
        shift
      }
      case ${OPTARG} in
        create)
          migrate="create"
          ;;
        up)
          migrate="up"
          ;;
        down)
          migrate="down"
          ;;
        latest)
          migrate="latest"
          ;;
        rollback)
          migrate="rollback"
          ;;
        unlock)
          migrate="unlock"
          ;;
        list)
          migrate="list"
          ;;
        compile)
          migrate="compile"
          ;;
        *)
          print_error "Invalid migration task: $OPTARG"
          exit 1
          ;;
      esac
      ;;
    h)
      print_usage
      exit 0
      ;;
    :)
      print_error "Invalid option: -$OPTARG requires an argument"
      exit 1
      ;;
    \?)
      print_error "Invalid option: -$OPTARG"
      exit 1
      ;;
    *) ;;
  esac
done

shift "$((OPTIND - 1))"

if [[ $no_action == "true" ]]; then
  migrate="latest"
  generate="true"
elif [[ -n $1 ]]; then
  print_error "Invalid arguments: $*"
  print_usage
  exit 1
fi

if [[ ! -f "$dbxfile" ]]; then
  print_error "$dbxfile should be a file"
  exit 1
fi

function compile_migration_files() {

  dbx_run migrations \
    --config="$dbxfile" \
    --action="knexfile" \
    --outdir="$distDir" \
    ;

}

if [[ "$migrate" == "create" ]]; then

  dbx_run migrations \
    --config="$dbxfile" \
    --action="create" \
    ;

  compile_migration_files
  exit $?

fi

if [[ -n "$migrate" ]]; then

  compile_migration_files

  if [[ $migrate == "compile" ]]; then
    print_success "Migration files successfully compiled ✨"
    exit 0
  fi

  knex_run --cwd "$distDir" \
    migrate:$migrate \
    $migrate_args \
    ;

fi

if [[ -n "$generate" ]]; then
  dbx_run generators --config="$dbxfile" --mode="$generate"
fi
