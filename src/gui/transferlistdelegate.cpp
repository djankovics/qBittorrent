/*
 * Bittorrent Client using Qt and libtorrent.
 * Copyright (C) 2006  Christophe Dumez <chris@qbittorrent.org>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 *
 * In addition, as a special exception, the copyright holders give permission to
 * link this program with the OpenSSL project's "OpenSSL" library (or with
 * modified versions of it that use the same license as the "OpenSSL" library),
 * and distribute the linked executables. You must obey the GNU General Public
 * License in all respects for all of the code used other than "OpenSSL".  If you
 * modify file(s), you may extend this exception to your version of the file(s),
 * but you are not obligated to do so. If you do not wish to do so, delete this
 * exception statement from your version.
 */

#include "transferlistdelegate.h"

#include <QApplication>
#include <QDateTime>
#include <QModelIndex>
#include <QPainter>
#include <QStyleOptionViewItem>

#if defined(Q_OS_WIN) || defined(Q_OS_MACOS)
#include <QProxyStyle>
#endif

#include "base/bittorrent/torrenthandle.h"
#include "base/preferences.h"
#include "base/types.h"
#include "base/unicodestrings.h"
#include "base/utils/misc.h"
#include "base/utils/string.h"
#include "transferlistmodel.h"

TransferListDelegate::TransferListDelegate(QObject *parent)
    : QItemDelegate(parent)
{
}

void TransferListDelegate::paint(QPainter *painter, const QStyleOptionViewItem &option, const QModelIndex &index) const
{
    painter->save();
    bool isHideState = true;
    if (Preferences::instance()->getHideZeroComboValues() == 1) {  // paused torrents only
        QModelIndex stateIndex = index.sibling(index.row(), TransferListModel::TR_STATUS);
        if (stateIndex.data().value<BitTorrent::TorrentState>() != BitTorrent::TorrentState::PausedDownloading)
            isHideState = false;
    }
    const bool hideValues = Preferences::instance()->getHideZeroValues() & isHideState;

    QStyleOptionViewItem opt = QItemDelegate::setOptions(index, option);
    QItemDelegate::drawBackground(painter, opt, index);
    switch (index.column()) {
    case TransferListModel::TR_AMOUNT_DOWNLOADED:
    case TransferListModel::TR_AMOUNT_UPLOADED:
    case TransferListModel::TR_AMOUNT_DOWNLOADED_SESSION:
    case TransferListModel::TR_AMOUNT_UPLOADED_SESSION:
    case TransferListModel::TR_AMOUNT_LEFT:
    case TransferListModel::TR_COMPLETED:
    case TransferListModel::TR_SIZE:
    case TransferListModel::TR_TOTAL_SIZE: {
            qlonglong size = index.data().toLongLong();
            if (hideValues && !size)
                break;
            opt.displayAlignment = (Qt::AlignRight | Qt::AlignVCenter);
            QItemDelegate::drawDisplay(painter, opt, option.rect, Utils::Misc::friendlyUnit(size));
        }
        break;
    case TransferListModel::TR_ETA: {
        opt.displayAlignment = Qt::AlignRight | Qt::AlignVCenter;
        QItemDelegate::drawDisplay(painter, opt, option.rect, Utils::Misc::userFriendlyDuration(index.data().toLongLong(), MAX_ETA));
        break;
    }
    case TransferListModel::TR_SEEDS:
    case TransferListModel::TR_PEERS: {
            qlonglong value = index.data().toLongLong();
            qlonglong total = index.data(Qt::UserRole).toLongLong();
            if (hideValues && (!value && !total))
                break;
            QString display = QString::number(value) + " (" + QString::number(total) + ')';
            opt.displayAlignment = Qt::AlignRight | Qt::AlignVCenter;
            QItemDelegate::drawDisplay(painter, opt, opt.rect, display);
        }
        break;
    case TransferListModel::TR_STATUS: {
            const auto state = index.data().value<BitTorrent::TorrentState>();
            QString display = getStatusString(state);
            QItemDelegate::drawDisplay(painter, opt, opt.rect, display);
        }
        break;
    case TransferListModel::TR_UPSPEED:
    case TransferListModel::TR_DLSPEED: {
            const int speed = index.data().toInt();
            if (hideValues && !speed)
                break;
            opt.displayAlignment = Qt::AlignRight | Qt::AlignVCenter;
            QItemDelegate::drawDisplay(painter, opt, opt.rect, Utils::Misc::friendlyUnit(speed, true));
        }
        break;
    case TransferListModel::TR_UPLIMIT:
    case TransferListModel::TR_DLLIMIT: {
            const qlonglong limit = index.data().toLongLong();
            if (hideValues && !limit)
                break;
            opt.displayAlignment = Qt::AlignRight | Qt::AlignVCenter;
            QItemDelegate::drawDisplay(painter, opt, opt.rect, limit > 0 ? Utils::Misc::friendlyUnit(limit, true) : QString::fromUtf8(C_INFINITY));
        }
        break;
    case TransferListModel::TR_TIME_ELAPSED: {
            const qlonglong elapsedTime = index.data().toLongLong();
            const qlonglong seedingTime = index.data(Qt::UserRole).toLongLong();
            const QString txt = (seedingTime > 0)
                ? tr("%1 (seeded for %2)", "e.g. 4m39s (seeded for 3m10s)")
                    .arg(Utils::Misc::userFriendlyDuration(elapsedTime)
                        , Utils::Misc::userFriendlyDuration(seedingTime))
                : Utils::Misc::userFriendlyDuration(elapsedTime);
            QItemDelegate::drawDisplay(painter, opt, opt.rect, txt);
        }
        break;
    case TransferListModel::TR_ADD_DATE:
    case TransferListModel::TR_SEED_DATE:
        QItemDelegate::drawDisplay(painter, opt, opt.rect, index.data().toDateTime().toLocalTime().toString(Qt::DefaultLocaleShortDate));
        break;
    case TransferListModel::TR_RATIO_LIMIT:
    case TransferListModel::TR_RATIO: {
            const qreal ratio = index.data().toDouble();
            if (hideValues && (ratio <= 0))
                break;
            QString str = ((ratio == -1) || (ratio > BitTorrent::TorrentHandle::MAX_RATIO)) ? QString::fromUtf8(C_INFINITY) : Utils::String::fromDouble(ratio, 2);
            opt.displayAlignment = Qt::AlignRight | Qt::AlignVCenter;
            QItemDelegate::drawDisplay(painter, opt, opt.rect, str);
        }
        break;
    case TransferListModel::TR_QUEUE_POSITION: {
            const int queuePos = index.data().toInt();
            opt.displayAlignment = Qt::AlignRight | Qt::AlignVCenter;
            if (queuePos > 0) {
                QItemDelegate::paint(painter, opt, index);
            }
            else {
                QItemDelegate::drawDisplay(painter, opt, opt.rect, "*");
            }
        }
        break;
    case TransferListModel::TR_PROGRESS: {
            QStyleOptionProgressBar newopt;
            qreal progress = index.data().toDouble() * 100.;
            newopt.rect = opt.rect;
            newopt.text = ((progress == 100.0) ? QString("100%") : Utils::String::fromDouble(progress, 1) + '%');
            newopt.progress = static_cast<int>(progress);
            newopt.maximum = 100;
            newopt.minimum = 0;
            newopt.state |= QStyle::State_Enabled;
            newopt.textVisible = true;
#if !defined(Q_OS_WIN) && !defined(Q_OS_MACOS)
            QApplication::style()->drawControl(QStyle::CE_ProgressBar, &newopt, painter);
#else
            // XXX: To avoid having the progress text on the right of the bar
            QProxyStyle st("fusion");
            st.drawControl(QStyle::CE_ProgressBar, &newopt, painter, 0);
#endif
        }
        break;
    case TransferListModel::TR_LAST_ACTIVITY: {
            qlonglong elapsed = index.data().toLongLong();
            if (hideValues && ((elapsed < 0) || (elapsed >= MAX_ETA)))
                break;

            // Show '< 1m ago' when elapsed time is 0
            if (elapsed == 0)
                elapsed = 1;

            QString elapsedString = (elapsed >= 0)
                ? tr("%1 ago", "e.g.: 1h 20m ago").arg(Utils::Misc::userFriendlyDuration(elapsed))
                : Utils::Misc::userFriendlyDuration(elapsed);

            opt.displayAlignment = Qt::AlignRight | Qt::AlignVCenter;
            QItemDelegate::drawDisplay(painter, opt, option.rect, elapsedString);
        }
        break;

    case TransferListModel::TR_AVAILABILITY: {
            const qreal availability = index.data().toReal();
            if (hideValues && (availability <= 0))
                break;

            const QString availabilityStr = Utils::String::fromDouble(availability, 3);
            opt.displayAlignment = (Qt::AlignRight | Qt::AlignVCenter);
            QItemDelegate::drawDisplay(painter, opt, option.rect, availabilityStr);
        }
        break;

    default:
        QItemDelegate::paint(painter, option, index);
    }
    painter->restore();
}

QWidget *TransferListDelegate::createEditor(QWidget *, const QStyleOptionViewItem &, const QModelIndex &) const
{
    // No editor here
    return nullptr;
}

QSize TransferListDelegate::sizeHint(const QStyleOptionViewItem &option, const QModelIndex &index) const
{
    // Reimplementing sizeHint() because the 'name' column contains text+icon.
    // When that WHOLE column goes out of view(eg user scrolls horizontally)
    // the rows shrink if the text's height is smaller than the icon's height.
    // This happens because icon from the 'name' column is no longer drawn.

    static int nameColHeight = -1;
    if (nameColHeight == -1) {
        QModelIndex nameColumn = index.sibling(index.row(), TransferListModel::TR_NAME);
        nameColHeight = QItemDelegate::sizeHint(option, nameColumn).height();
    }

    QSize size = QItemDelegate::sizeHint(option, index);
    size.setHeight(std::max(nameColHeight, size.height()));
    return size;
}

QString TransferListDelegate::getStatusString(const BitTorrent::TorrentState state) const
{
    QString str;

    switch (state) {
    case BitTorrent::TorrentState::Downloading:
        str = tr("Downloading");
        break;
    case BitTorrent::TorrentState::StalledDownloading:
        str = tr("Stalled", "Torrent is waiting for download to begin");
        break;
    case BitTorrent::TorrentState::DownloadingMetadata:
        str = tr("Downloading metadata", "used when loading a magnet link");
        break;
    case BitTorrent::TorrentState::ForcedDownloading:
        str = tr("[F] Downloading", "used when the torrent is forced started. You probably shouldn't translate the F.");
        break;
    case BitTorrent::TorrentState::Allocating:
        str = tr("Allocating", "qBittorrent is allocating the files on disk");
        break;
    case BitTorrent::TorrentState::Uploading:
    case BitTorrent::TorrentState::StalledUploading:
        str = tr("Seeding", "Torrent is complete and in upload-only mode");
        break;
    case BitTorrent::TorrentState::ForcedUploading:
        str = tr("[F] Seeding", "used when the torrent is forced started. You probably shouldn't translate the F.");
        break;
    case BitTorrent::TorrentState::QueuedDownloading:
    case BitTorrent::TorrentState::QueuedUploading:
        str = tr("Queued", "i.e. torrent is queued");
        break;
    case BitTorrent::TorrentState::CheckingDownloading:
    case BitTorrent::TorrentState::CheckingUploading:
        str = tr("Checking", "Torrent local data is being checked");
        break;
    case BitTorrent::TorrentState::CheckingResumeData:
        str = tr("Checking resume data", "used when loading the torrents from disk after qbt is launched. It checks the correctness of the .fastresume file. Normally it is completed in a fraction of a second, unless loading many many torrents.");
        break;
    case BitTorrent::TorrentState::PausedDownloading:
        str = tr("Paused");
        break;
    case BitTorrent::TorrentState::PausedUploading:
        str = tr("Completed");
        break;
    case BitTorrent::TorrentState::Moving:
        str = tr("Moving", "Torrent local data are being moved/relocated");
        break;
    case BitTorrent::TorrentState::MissingFiles:
        str = tr("Missing Files");
        break;
    case BitTorrent::TorrentState::Error:
        str = tr("Errored", "torrent status, the torrent has an error");
        break;
    default:
        str = "";
    }

    return str;
}
