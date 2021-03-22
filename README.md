# BeFriendlier

Looking to match with POG Twitch friends?

## External APIs in use

* [Perspective API](https://www.perspectiveapi.com/)

## Requirements

* Production:
  * postgresql

## Features

* Website profile page.
  * Customizable background color.
  * 5 favorite streamers.
  * 5 favorite Twitch emotes.
  * 128 characters bio.
* Twitch bot.

## Changelogs

* [Website](CHANGELOG.md)
* [Bot](https://github.com/KararTY/BeFriendlier-Bot/blob/master/CHANGELOG.md)
* [Shared](https://github.com/KararTY/BeFriendlier-Shared/blob/master/CHANGELOG.md)

## Setup

* `npm i` / `yarn i` / `pnpm i --shamefully-hoist` to install packages.
* Copy `.env.example`, to a new file named `.env`.
* Change the environment values in the new `.env` file.
* Check `config/` directory for other configurations to change. Default config values should be sufficient for development, however.
* If your `DB_CONNECTION` is not set to `sqlite`, make sure to create a database with the same name under `DB_NAME`.
* `npm run r:m:s` for seeding the database with initial values. If `NODE_ENV` is set to `development`, you will also get development values to test around with.
* `npm start-test` to start web server in watch mode (Reloads on file change) with debugging websocket enabled.
* Or alternatively `npm start` to start web server in "production" mode (No reloading on file change and no debugging websocket). That's it.

## Contributing

* Use the provided eslint `.eslintrc.json` file.
* Run `npm run lint` to check for formatting issues.
* Run `npm run lintfix` to fix formatting issues.
* Always create a new branch, it's recommended to not push to master.
* Issue a pull request. Pull requests are squashed into 1 commit.
* Use semver semantics in your commits, and make sure they adhere to the conventional commits specification. [Read more here](https://www.conventionalcommits.org/en/v1.0.0/).
* If you are creating a release in your own fork, run `npm run release`.

## Database relationships

* User
  * hasMany: Profile
  * manyToMany: Favorite streamers list. (Matches to other users)
* Profile
  * manyToMany: Matches list. (Matches to other profiles)
* (Pivot) Favorite streamers list.
* (Pivot) Matches list.

## Todo

[Check project page for Todo list.](https://github.com/users/KararTY/projects/1)
